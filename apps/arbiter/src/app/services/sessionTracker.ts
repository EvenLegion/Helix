import { ChannelType, VoiceChannel, StageChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";

const activeTimers = new Map<number, NodeJS.Timeout>();
const prevMembersBySession = new Map<number, Set<string>>();
const prevMemberNamesBySession = new Map<number, Map<string, string>>();
const lastActivityBySession = new Map<number, number>();
const inactivityWatchers = new Map<number, NodeJS.Timeout>();

// Simple sampling approach: every SAMPLE_SECONDS, count present members and increment totals.
// Speaking detection is non-trivial via discord.js; speaking events require a voice receiver/bot in channel.
// For now, we approximate speaking as "unmuted and not deafened". Can be replaced with proper audio/speaking integration later.
const SAMPLE_SECONDS = 15;
const IS_DEV = ["development", "dev", "local"].includes(String(process.env.NODE_ENV || "").toLowerCase())
  || String(process.env.EVENT_INACTIVITY_DEV || "").toLowerCase() === "1";
const DEFAULT_INACTIVITY_MINUTES = IS_DEV ? 1 : 30;
const INACTIVITY_MINUTES = Number(process.env.EVENT_INACTIVITY_MINUTES || DEFAULT_INACTIVITY_MINUTES);
const INACTIVITY_MS = INACTIVITY_MINUTES * 60_000;
const VERBOSE = ["1", "true", "on", "yes"].includes(String(process.env.EVENT_TRACK_VERBOSE || "").toLowerCase());
// Notification channel name: allow env override; default to 'test' in dev, 'bot-requests' otherwise
const NOTIFY_CHANNEL_NAME = (process.env.EVENT_NOTIFY_CHANNEL && process.env.EVENT_NOTIFY_CHANNEL.trim().length)
  ? process.env.EVENT_NOTIFY_CHANNEL.trim()
  : (IS_DEV ? "commands" : "bot-requests");
const NOTIFY_CHANNEL_ID = (process.env.EVENT_NOTIFY_CHANNEL_ID && process.env.EVENT_NOTIFY_CHANNEL_ID.trim().length)
  ? process.env.EVENT_NOTIFY_CHANNEL_ID.trim()
  : undefined;
import type { Guild, Role, Client } from "discord.js";
function findRole(guild: Guild, names: string[]): Role | null {
  for (const name of names) {
    const role = guild.roles.cache.find((r: Role) => r.name === name);
    if (role) return role;
  }
  return null;
}

// Resolve a dev user id for notifications in dev: prefer env, else application owner, else null
let cachedDevUserId: string | null | undefined;
async function resolveDevUserId(client: Client): Promise<string | null> {
  if (typeof cachedDevUserId !== 'undefined') return cachedDevUserId ?? null;
  const envId = (process.env.EVENT_DEV_NOTIFY_USER_ID || '').trim();
  if (envId) {
    cachedDevUserId = envId;
    return cachedDevUserId ?? null;
  }
  try {
    // Ensure application is fetched to populate owner
    const app = client.application?.owner ? client.application : await client.application?.fetch();
    const owner: any = app?.owner as any;
    if (owner) {
      // If single-user owner
      if (owner?.id && typeof owner.id === 'string') {
        cachedDevUserId = owner.id;
        return cachedDevUserId ?? null;
      }
      // If team owner
      const teamOwner = owner?.ownerId || owner?.owner?.id;
      if (teamOwner && typeof teamOwner === 'string') {
        cachedDevUserId = teamOwner;
        return cachedDevUserId ?? null;
      }
      // Fallback: first team member
      const firstMemberId = owner?.members?.first?.()?.user?.id;
      if (firstMemberId) {
        cachedDevUserId = firstMemberId;
        return cachedDevUserId ?? null;
      }
    }
  } catch { /* ignore */ }
  cachedDevUserId = null;
  return cachedDevUserId;
}

async function notifyInactivity(client: Client, guildId: string, sessionId: number, vcId: string) {
  const log = childLogger({ mod: "eventTrack", sessionId, guildId, channelId: vcId });
  log.debug("Preparing inactivity notification");
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
  const channel = guild.channels.cache.get(vcId);
  // Dev-only: resolve specific user (by ID, with username fallback) for DM/mention
  let devMention = "";
  let devIdToPing: string | null = null;
  if (IS_DEV) {
    devIdToPing = await resolveDevUserId(client);
    if (devIdToPing) {
      devMention = ` <@${devIdToPing}>`;
      log.debug({ devId: devIdToPing }, "Resolved dev user for notification");
    } else {
      log.warn("No dev user resolved for dev notification; set EVENT_DEV_NOTIFY_USER_ID to override.");
    }
  }

  // Resolve leadership roles for mentions
  const admirals = findRole(guild, ["Admirallus (Admiral)", "Admiral", "Admirallus"]);
  const imperators = findRole(guild, ["Imperator (Commander)", "Imperator", "Commander"]);
  log.debug({ admiralsId: admirals?.id, imperatorsId: imperators?.id }, "Resolved leadership roles for inactivity mention");

  let mention = "";
  if (admirals) mention += `<@&${admirals.id}> `;
  if (imperators) mention += `<@&${imperators.id}>`;

  const msg = `⚠️ Event session ${sessionId} in <#${vcId}> has had no voice activity for ${INACTIVITY_MINUTES} minutes or the channel was closed. Please review and close the event if appropriate. ${mention}${devMention}\nrun: /event stop <#${vcId}> to close out the event, or click the button below to close the event.`;
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`event:close:${sessionId}`)
        .setLabel("Close Event")
        .setStyle(ButtonStyle.Danger)
    )
  ];

  // Dev-only: send the same message as a DM
  if (IS_DEV && devIdToPing) {
    const targetId = devIdToPing;
    try {
      const target = await guild.members.fetch(targetId).catch(() => null as any);
      if (target) {
        await target.send({ content: msg, components });
        log.debug({ devId: target.id }, "Inactivity DM sent to dev user");
      }
    } catch (e) {
      log.warn({ err: e }, "Failed to send inactivity DM to dev user");
    }
  }

  // Resolve notify channel by ID first, then by name
  let notifyChan: TextChannel | undefined;
  if (NOTIFY_CHANNEL_ID) {
    notifyChan = (guild.channels.cache.get(NOTIFY_CHANNEL_ID) as TextChannel) || (await guild.channels.fetch(NOTIFY_CHANNEL_ID).catch(() => undefined) as any);
    log.debug({ channelId: NOTIFY_CHANNEL_ID, found: !!notifyChan }, "Notify channel resolution by ID");
  }
  if (!notifyChan) {
    const desiredName = NOTIFY_CHANNEL_NAME.replace(/^#/, "");
    notifyChan = guild.channels.cache.find((c: any) => c.name === desiredName && c.isTextBased()) as TextChannel | undefined;
    log.debug({ desiredName, found: !!notifyChan }, "Notify channel resolution by name");
  }
  if (!notifyChan) {
    const desiredName = NOTIFY_CHANNEL_NAME.replace(/^#/, "");
    log.warn({ desiredName, desiredId: NOTIFY_CHANNEL_ID }, "No notify channel found; skipping channel notification");
    return;
  }
  log.debug({ channelId: notifyChan.id, guildId }, "Sending inactivity notification to configured channel");
  const sent = await (notifyChan as any).send({ content: msg, components });
  log.debug({ messageId: (sent as any).id }, "Inactivity notification sent");
}

export async function startSessionTracker(client: any, sessionId: number, guildId: string, vcId: string) {
  // Avoid duplicate trackers per session
  if (activeTimers.has(sessionId)) return;
  const log = childLogger({ mod: "eventTrack", sessionId, guildId, channelId: vcId });

  // Load session to identify the creator responsible for the event
  let creatorId: string | null = null;
  try {
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    creatorId = session?.startedBy || null;
    log.debug({ creatorId }, "Loaded event session creator");
  } catch (err) {
    log.warn({ err }, "Failed to load event session; proceeding without creator enforcement");
  }

  // Start inactivity watcher
  lastActivityBySession.set(sessionId, Date.now());
  if (!inactivityWatchers.has(sessionId)) {
    const watcher = setInterval(async () => {
      const last = lastActivityBySession.get(sessionId) || 0;
      const elapsed = Date.now() - last;
      log.debug({ last, elapsedMs: elapsed, thresholdMs: INACTIVITY_MS, thresholdMin: INACTIVITY_MINUTES }, "Inactivity check");
      if (elapsed > INACTIVITY_MS) {
        log.info("Inactivity threshold reached; notifying leadership");
        await notifyInactivity(client, guildId, sessionId, vcId);
        clearInterval(watcher);
        inactivityWatchers.delete(sessionId);
      }
      // VC deletion is handled in tick below
    }, 60_000);
    inactivityWatchers.set(sessionId, watcher);
  }

  const tick = async () => {
    try {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.get(vcId) ?? await guild.channels.fetch(vcId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
        // End session if channel not found
        await prisma.eventSession.update({ where: { id: sessionId }, data: { endedAt: new Date(), status: "ENDED" } });
        log.warn("Channel not found; ending session");
        log.debug("Channel missing or deleted; sending inactivity/closure notification");
        await notifyInactivity(client, guildId, sessionId, vcId);
        stopSessionTracker(sessionId);
        return;
      }

      const vc = channel as VoiceChannel | StageChannel;
      // Ensure members cache
      await vc.guild.members.fetch();

      // Members currently connected
      const members = vc.members;
      const now = new Date();

      // Determine speaking-like activity and whether creator is present
      const speakingCandidates = Array.from(members.values()).filter(m => {
        const v = m.voice;
        return !(v.selfMute || v.serverMute || v.selfDeaf || v.serverDeaf);
      });
      const creatorPresent = !!(creatorId && members.has(creatorId));

      // Update last activity only when someone is potentially speaking AND the creator is present
      if (speakingCandidates.length > 0 && creatorPresent) {
        lastActivityBySession.set(sessionId, Date.now());
        log.debug(
          { members: members.size, speakingLike: speakingCandidates.length, creatorPresent },
          "Speaking-like activity with creator present; lastActivity updated"
        );
      } else {
        log.debug(
          { members: members.size, speakingLike: speakingCandidates.length, creatorPresent },
          "No speaking-like activity or creator not present; lastActivity NOT updated"
        );
      }

      // Upsert participants and add SAMPLE_SECONDS to presence time for everyone connected
      for (const [memberId, member] of members) {
        await prisma.eventSessionParticipant.upsert({
          where: { eventSessionId_userId: { eventSessionId: sessionId, userId: memberId } },
          create: {
            eventSessionId: sessionId,
            userId: memberId,
            totalSecondsPresent: SAMPLE_SECONDS,
            lastJoinAt: now,
          },
          update: {
            totalSecondsPresent: { increment: SAMPLE_SECONDS },
            lastJoinAt: now,
          },
        });
      }

      // Naive speaking approximation: increment speaking time for those not self-muted and not server-muted
      for (const [memberId, member] of members) {
        const vs = member.voice;
        const isPotentiallySpeaking = !(vs.selfMute || vs.serverMute || vs.selfDeaf || vs.serverDeaf);
        if (isPotentiallySpeaking) {
          await prisma.eventSessionParticipant.update({
            where: { eventSessionId_userId: { eventSessionId: sessionId, userId: memberId } },
            data: { totalSecondsSpeaking: { increment: SAMPLE_SECONDS }, lastSpeakAt: now },
          });
        }
      }

      // If nobody is connected for multiple consecutive ticks, you may choose to end the session automatically.
      // Skipping auto-end for now; expose a manual /event stop to finalize.

      // Logging to terminal (reuse computed speakingCandidates)

      const prev = prevMembersBySession.get(sessionId) ?? new Set<string>();
      const prevNames = prevMemberNamesBySession.get(sessionId) ?? new Map<string, string>();
      const current = new Set(Array.from(members.keys()));
      const joined: string[] = [];
      const left: string[] = [];
      for (const id of current) if (!prev.has(id)) joined.push(id);
      for (const id of prev) if (!current.has(id)) left.push(id);
      prevMembersBySession.set(sessionId, current);
      // Build current names map for next tick
      const currentNames = new Map<string, string>();
      for (const [id, m] of members) currentNames.set(id, m.displayName || m.user?.username || id);
      prevMemberNamesBySession.set(sessionId, currentNames);

      const chanName = (vc as any).name ?? vcId;
      log.debug({ ts: now.toISOString(), channelName: chanName, members: members.size, speakingLike: speakingCandidates.length }, "Tick");
      if (joined.length || left.length) {
        if (joined.length) {
          const joinedPretty = joined.map(id => {
            const m = members.get(id);
            return m ? `${m.displayName} (${id})` : id;
          }).join(", ");
          log.debug({ joined, pretty: joinedPretty }, "+ joined");
        }
        if (left.length) {
          const leftPretty = left.map(id => {
            // Prefer previous tick's known display name; fallback to guild cache; else id
            const name = prevNames.get(id) || (vc.guild.members.cache.get(id)?.displayName) || id;
            return `${name} (${id})`;
          }).join(", ");
          log.debug({ left, pretty: leftPretty }, "- left");
        }
      }
      if (VERBOSE && members.size) {
        for (const m of members.values()) {
          const v = m.voice;
          const flags = [
            v.selfMute ? "selfMute" : null,
            v.serverMute ? "serverMute" : null,
            v.selfDeaf ? "selfDeaf" : null,
            v.serverDeaf ? "serverDeaf" : null,
          ].filter(Boolean);
          log.debug({ memberId: m.id, displayName: m.displayName, flags }, "member");
        }
      }

    } catch (err) {
      // Stop tracker if session was deleted or serious errors occur
      const log = childLogger({ mod: "eventTrack", sessionId, guildId, channelId: vcId });
      log.error({ err }, "Session tracker error");
    }
  };

  // Run immediately then on interval
  log.debug({ sampleSeconds: SAMPLE_SECONDS }, "Starting session tracker");
  await tick();
  const timer = setInterval(tick, SAMPLE_SECONDS * 1000);
  activeTimers.set(sessionId, timer);
}

export function stopSessionTracker(sessionId: number) {
  const t = activeTimers.get(sessionId);
  if (t) {
    clearInterval(t);
    activeTimers.delete(sessionId);
    prevMembersBySession.delete(sessionId);
    const log = childLogger({ mod: "eventTrack", sessionId });
    log.debug("Stopped session tracker");
    if (inactivityWatchers.has(sessionId)) {
      clearInterval(inactivityWatchers.get(sessionId));
      inactivityWatchers.delete(sessionId);
    }
    lastActivityBySession.delete(sessionId);
  }
}
