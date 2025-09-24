import { ChannelType, VoiceChannel, StageChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel, PermissionsBitField } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";
import { setNotifyInfo } from "../services/notifyStore";

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
const DEFAULT_INACTIVITY_MINUTES = IS_DEV ? .5 : 30;
const INACTIVITY_MINUTES = Number(process.env.EVENT_INACTIVITY_MINUTES || DEFAULT_INACTIVITY_MINUTES);
const INACTIVITY_MS = INACTIVITY_MINUTES * 60_000;
// Notification channel name: allow env override; default to 'commands' in dev, 'bot-requests' otherwise
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
  // Load session details to provide description in messages
  const session = await prisma.eventSession.findUnique({ where: { id: sessionId } }).catch(() => null as any);
  const rootId = session?.rootSessionId ?? session?.id ?? sessionId;
  const awardDesc = String((session as any)?.awardDescription ?? '').replace(/[\r\n]+/g, ' ').trim();
  const descPart = awardDesc ? ` — ${awardDesc}` : '';
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

  const msg = `⚠️ Event session ${sessionId} in <#${vcId}>${descPart} has had no voice activity for ${INACTIVITY_MINUTES} minutes or the channel was closed. Please review and close the event if appropriate.\nrun: /event stop <#${vcId}> to close out the event, or click the button below to close the event.`;
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

  // Resolve notify channel by ID first, then by name (with fallbacks)
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
    const fallbacks = ["bot-requests", "commands", "bot-commands", "bot"]; // try some common names
    for (const name of fallbacks) {
      const ch = guild.channels.cache.find((c: any) => c.name === name && c.isTextBased());
      if (ch) { notifyChan = ch as TextChannel; log.debug({ name }, "Notify channel fallback matched by name"); break; }
    }
  }
  if (!notifyChan) {
    const desiredName = NOTIFY_CHANNEL_NAME.replace(/^#/, "");
    log.warn({ desiredName, desiredId: NOTIFY_CHANNEL_ID }, "No notify channel found; skipping channel notification and relying on dev DM if enabled");
    return;
  }
  log.debug({ channelId: notifyChan.id, guildId }, "Sending inactivity notification to configured channel");
  const sent = await (notifyChan as any).send({ content: msg, components, allowedMentions: { parse: [], repliedUser: false } });
  log.debug({ messageId: (sent as any).id }, "Inactivity notification sent");

  // Try to create a thread for follow-up actions/closure status
  try {
    let threadId: string | undefined;
    let threadObj: any | undefined;
    const anyMsg = sent as any;
    // Build a readable thread name: "Stale Event Tracking: <VC Name>"
    const vc = guild.channels.cache.get(vcId) ?? await guild.channels.fetch(vcId).catch(() => null as any);
    const vcName = (vc as any)?.name || `vc-${vcId}`;
    const MAX = 100;
    let name = `Stale Event Tracking: ${vcName}`;
    if (name.length > MAX) {
      name = name.slice(0, MAX);
    }
    // Create a thread anchored to the alert message (preferred)
    // Check permissions to provide clearer diagnostics
    try {
      const me = guild.members.me ?? await guild.members.fetch(client.user!.id);
      const perms = notifyChan.permissionsFor(me!);
      const canCreatePublic = perms?.has(PermissionsBitField.Flags.CreatePublicThreads) ?? false;
      const canCreatePrivate = perms?.has(PermissionsBitField.Flags.CreatePrivateThreads) ?? false;
      const canSendInThreads = perms?.has(PermissionsBitField.Flags.SendMessagesInThreads) ?? false;
      log.debug({ canCreatePublic, canCreatePrivate, canSendInThreads, channelType: (notifyChan as any).type }, "Thread permissions in notify channel");
    } catch (e) {
      log.warn({ err: e }, "Failed to check bot permissions in notify channel");
    }
    let threadError: any | undefined;
    // Attempt channel.threads.create with startMessage to guarantee anchoring
    try {
      const created = await (notifyChan as any).threads.create({ name, autoArchiveDuration: 60, startMessage: anyMsg, type: ChannelType.PublicThread, reason: `Inactivity for session ${rootId}` });
      threadId = created?.id as string | undefined;
      threadObj = created;
      log.debug({ threadId, parentMessageId: anyMsg.id, threadType: created?.type, threadUrl: created?.url }, "Primary thread create (startMessage) succeeded");
    } catch (e) {
      threadError = e;
      log.warn({ err: e }, "channel.threads.create with startMessage failed; trying message.startThread next");
    }
    if (!threadObj && typeof anyMsg.startThread === 'function') {
      try {
        const thread = await anyMsg.startThread({ name, autoArchiveDuration: 60, reason: `Inactivity for session ${rootId}` });
        threadId = thread?.id as string | undefined;
        threadObj = thread;
        log.debug({ threadId, parentMessageId: anyMsg.id, threadType: (thread as any)?.type, threadUrl: (thread as any)?.url }, "Fallback message.startThread succeeded");
      } catch (e) {
        threadError = e;
        log.warn({ err: e }, "message.startThread failed; will attempt channel.threads.create without startMessage");
      }
    } else if (!threadObj) {
      log.warn("Cannot start thread: message.startThread not available on sent message");
    }
    if (!threadObj) {
      // Fallback to creating a standalone public thread if supported
      try {
        const created = await (notifyChan as any).threads.create({ name, autoArchiveDuration: 60, type: ChannelType.PublicThread, reason: `Inactivity for session ${rootId}` });
        threadId = created?.id as string | undefined;
        threadObj = created;
        log.debug({ threadId, parentMessageId: anyMsg.id, threadType: created?.type, threadUrl: created?.url }, "Fallback channel.threads.create (no startMessage) succeeded");
      } catch (e) {
        log.warn({ err: e, prevErr: threadError }, "Both thread creation strategies failed; will try private thread if permissions allow");
        // Try private thread as a last resort
        try {
          const createdPriv = await (notifyChan as any).threads.create({ name, autoArchiveDuration: 60, reason: `Inactivity for session ${rootId}`, type: ChannelType.PrivateThread });
          threadId = createdPriv?.id as string | undefined;
          threadObj = createdPriv;
          log.debug({ threadId, parentMessageId: anyMsg.id, threadType: createdPriv?.type, threadUrl: createdPriv?.url }, "Private thread creation succeeded");
        } catch (e2) {
          log.warn({ err: e2 }, "Private thread creation also failed");
        }
      }
    }
    // Post leadership ping inside the thread for focused follow-up
    try {
      // Only ping leadership roles in the thread; don't @ the dev/user specifically here
      const pingLine = `${mention}`.trim();
      const jump = (sent as any)?.url as string | undefined;
      if (threadObj) {
        await threadObj.send({
          content: `${pingLine}${pingLine ? ' — ' : ''}Event session ${rootId} in <#${vcId}>${descPart} has had no voice activity for ${INACTIVITY_MINUTES} minutes or the channel was closed. ${jump ?? ''}`.trim(),
          components,
          allowedMentions: { parse: ['roles'], repliedUser: false },
        });
        log.debug({ threadId, threadUrl: (threadObj as any)?.url }, "Posted leadership ping inside thread");
      } else {
        // As a fallback when no thread could be created, edit the parent message to include the role ping so leadership is notified
        const fallbackContent = `${pingLine}${pingLine ? ' — ' : ''}${msg}`;
        await (anyMsg.edit?.({ content: fallbackContent, components, allowedMentions: { parse: ['roles'], repliedUser: false } }) ?? Promise.resolve());
        log.warn("Thread not created; edited parent message to include role mention as fallback");
      }
    } catch (e) {
      log.warn({ err: e }, "Failed to send leadership ping to thread");
    }
    // Store under child and root ids for robustness (only if a thread was actually created)
    if (threadId) {
      setNotifyInfo(sessionId, { channelId: (notifyChan as any).id as string, messageId: (sent as any).id as string, threadId });
      if (rootId && rootId !== sessionId) setNotifyInfo(rootId, { channelId: (notifyChan as any).id as string, messageId: (sent as any).id as string, threadId });
      log.debug({ threadId, rootId }, "Inactivity thread created and stored");
    } else {
      log.warn({ rootId }, "No threadId present after creation attempts; using parent message fallback only");
    }
  } catch (e) {
    log.warn({ err: e }, "Failed to create or store inactivity thread");
  }
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
      if (members.size) {
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
