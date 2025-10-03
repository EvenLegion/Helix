import { ChannelType, VoiceChannel, StageChannel } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type TextChannel, PermissionsBitField } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";
import { getNotifyInfo, setNotifyInfo } from "../services/notifyStore";

const activeTimers = new Map<number, NodeJS.Timeout>();
const prevMembersBySession = new Map<number, Set<string>>();
const prevMemberNamesBySession = new Map<number, Map<string, string>>();
const lastActivityBySession = new Map<number, number>();
// Group-level last activity across all sessions under a root
const lastGroupActivityByRoot = new Map<number, number>();
// child sessionId -> rootId
const sessionToRoot = new Map<number, number>();
// rootId -> root channelId
const rootChannelIdByRoot = new Map<number, string>();
// One inactivity watcher per root group (keyed by rootId)
const inactivityWatchers = new Map<number, NodeJS.Timeout>();
// Roots that have already sent an inactivity notification (to avoid duplicates)
const rootInactivityNotified = new Set<number>();

// Simple sampling approach: every SAMPLE_SECONDS, count present members and increment totals.
// Speaking detection is non-trivial via discord.js; speaking events require a voice receiver/bot in channel.
// For now, we approximate speaking as "unmuted and not deafened". Can be replaced with proper audio/speaking integration later.
const SAMPLE_SECONDS = 15;
const DEV_INACTIVITY_MINUTES = 0.5;
const PROD_INACTIVITY_MINUTES = 15;
const IS_DEV = ["development", "dev", "local"].includes(String(process.env.NODE_ENV || "").toLowerCase())
  || String(process.env.EVENT_INACTIVITY_DEV || "").toLowerCase() === "1";
const DEFAULT_INACTIVITY_MINUTES = IS_DEV ? DEV_INACTIVITY_MINUTES : PROD_INACTIVITY_MINUTES;
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

  // Resolve leadership roles for mentions (Admirals, Imperators, Staff, Admin role if present), and the event creator
  const admirals = findRole(guild, ["Admirallus (Admiral)", "Admiral", "Admirallus"]);
  const imperators = findRole(guild, ["Imperator (Commander)", "Imperator", "Commander"]);
  const staffRole = findRole(guild, ["Server Staff", "Staff"]);
  const adminRole = findRole(guild, ["Admin", "Administrator"]);
  log.debug({ admiralsId: admirals?.id, imperatorsId: imperators?.id, staffId: staffRole?.id, adminId: adminRole?.id }, "Resolved leadership roles for inactivity mention");

  let mention = "";
  if (admirals) mention += `<@&${admirals.id}> `;
  if (imperators) mention += `<@&${imperators.id}> `;
  if (staffRole) mention += `<@&${staffRole.id}> `;
  if (adminRole) mention += `<@&${adminRole.id}> `;
  const creatorMention = session?.startedBy ? `<@${session.startedBy}> ` : "";
  const msg = `${mention}${creatorMention}Please make sure someone closes out the merit tracking for event session ${sessionId} in <#${vcId}>${descPart}.\nUse /event stop <#${vcId}> or click the button below to close the event.`.trim();
  const mentionRoleIds = [admirals?.id, imperators?.id, staffRole?.id, adminRole?.id].filter(Boolean) as string[];
  const mentionUserIds = session?.startedBy ? [session.startedBy] : [];
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

  // Try to post inside the existing root thread, or create/reuse a thread by name; avoid parent-channel messages
  let threadToUse: any | undefined;
  try {
    const info = getNotifyInfo(rootId);
    if (info?.threadId) {
      const fetched = await guild.channels.fetch(info.threadId).catch(() => null as any);
      if (fetched && (fetched as any).send) threadToUse = fetched as any;
    }
  } catch { /* ignore */ }

  // Resolve notify channel (needed to search or create a thread)
  let notifyChan: TextChannel | undefined;
  if (!threadToUse) {
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
      log.warn({ desiredName, desiredId: NOTIFY_CHANNEL_ID }, "No notify channel found; cannot post inactivity");
      return;
    }
    // Compute expected thread name
    const vcForName = guild.channels.cache.get(vcId) ?? await guild.channels.fetch(vcId).catch(() => null as any);
    const vcNameForThread = (vcForName as any)?.name || `vc-${vcId}`;
    const prefix = `Event started: ${vcNameForThread}: `;
    const MAX = 100;
    const maxDesc = Math.max(0, MAX - prefix.length);
    const descForName = awardDesc.slice(0, maxDesc);
    const expectedName = `${prefix}${descForName}`;
    // Try to find an existing thread by name (active then archived)
    try { await (notifyChan as any).threads.fetchActive(); } catch { /* ignore */ }
    threadToUse = (notifyChan as any).threads?.cache?.find?.((t: any) => t?.name === expectedName && typeof t?.send === 'function');
    if (!threadToUse) {
      try {
        const archived: any = await (notifyChan as any).threads.fetchArchived?.().catch(() => null);
        const threads = archived?.threads || archived || [];
        threadToUse = threads.find?.((t: any) => t?.name === expectedName && typeof t?.send === 'function');
      } catch { /* ignore */ }
    }
    // Create a new thread directly (no parent-channel message) if none found
    if (!threadToUse) {
      try {
        const created = await (notifyChan as any).threads.create({ name: expectedName, autoArchiveDuration: 60, type: ChannelType.PublicThread, reason: `Inactivity for session ${rootId}` });
        threadToUse = created;
        log.debug({ threadId: created?.id }, "Created new thread for inactivity (no parent message)");
      } catch (e1) {
        log.warn({ err: e1 }, "Failed to create public thread; trying private thread");
        try {
          const createdPriv = await (notifyChan as any).threads.create({ name: expectedName, autoArchiveDuration: 60, type: ChannelType.PrivateThread, reason: `Inactivity for session ${rootId}` });
          threadToUse = createdPriv;
          log.debug({ threadId: createdPriv?.id }, "Created private thread for inactivity");
        } catch (e2) {
          log.error({ err: e2 }, "Failed to create any thread for inactivity");
        }
      }
      if (threadToUse) {
        const id = (threadToUse as any).id as string | undefined;
        if (id) {
          setNotifyInfo(sessionId, { channelId: (notifyChan as any).id as string, threadId: id });
          if (rootId && rootId !== sessionId) setNotifyInfo(rootId, { channelId: (notifyChan as any).id as string, threadId: id });
        }
      }
    }
  }

  // Post the inactivity message inside the thread only
  if (threadToUse) {
    await (threadToUse as any).send({ content: msg, components, allowedMentions: { roles: mentionRoleIds, users: mentionUserIds, parse: [], repliedUser: false } });
    log.debug({ threadId: (threadToUse as any).id }, "Inactivity notification posted inside thread");
  } else {
    log.warn("No thread available to post inactivity; skipping message");
  }
}

export async function startSessionTracker(client: any, sessionId: number, guildId: string, vcId: string) {
  // Avoid duplicate trackers per session
  if (activeTimers.has(sessionId)) return;
  const log = childLogger({ mod: "eventTrack", sessionId, guildId, channelId: vcId });

  // Load session to identify the creator responsible for the event
  let creatorId: string | null = null;
  // Determine group/root for inactivity consolidation
  let rootId: number = sessionId;
  let rootVcId: string = vcId;
  try {
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    creatorId = session?.startedBy || null;
    if (session?.rootSessionId) {
      rootId = session.rootSessionId;
      const root = await prisma.eventSession.findUnique({ where: { id: rootId } });
      rootVcId = root?.channelId || vcId;
    } else {
      rootId = session?.id || sessionId;
      rootVcId = session?.channelId || vcId;
    }
    sessionToRoot.set(sessionId, rootId);
    rootChannelIdByRoot.set(rootId, rootVcId);
    if (!lastGroupActivityByRoot.has(rootId)) lastGroupActivityByRoot.set(rootId, Date.now());
    log.debug({ creatorId, rootId, rootVcId }, "Loaded event session creator and group context");
  } catch (err) {
    log.warn({ err }, "Failed to load event session; proceeding without creator enforcement");
  }

  // Start inactivity watcher (group-wide on root)
  lastActivityBySession.set(sessionId, Date.now());
  if (!inactivityWatchers.has(rootId)) {
    const watcher = setInterval(async () => {
      const last = lastGroupActivityByRoot.get(rootId) || 0;
      const elapsed = Date.now() - last;
      log.debug({ rootId, last, elapsedMs: elapsed, thresholdMs: INACTIVITY_MS, thresholdMin: INACTIVITY_MINUTES }, "Group inactivity check");
      if (elapsed > INACTIVITY_MS) {
        log.info("Group inactivity threshold reached; notifying leadership once for root");
        const rootVc = rootChannelIdByRoot.get(rootId) || vcId;
        await notifyInactivity(client, guildId, rootId, rootVc);
        rootInactivityNotified.add(rootId);
        clearInterval(watcher);
        inactivityWatchers.delete(rootId);
      }
      // VC deletion is handled in tick below
    }, 60_000);
    inactivityWatchers.set(rootId, watcher);
  }

  const tick = async () => {
    try {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.get(vcId) ?? await guild.channels.fetch(vcId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
        // End session if channel not found
        await prisma.eventSession.update({ where: { id: sessionId }, data: { endedAt: new Date(), status: "ENDED" } });
        log.warn("Channel not found; ending session");
        // Only notify once from the root session context and only if not already notified
        if (sessionId === rootId && !rootInactivityNotified.has(rootId)) {
          log.debug("Root channel missing or deleted; sending inactivity/closure notification");
          await notifyInactivity(client, guildId, rootId, rootVcId);
          rootInactivityNotified.add(rootId);
        } else {
          log.debug({ rootId }, "Child channel missing or deleted; skipping notification (root watcher will handle group inactivity)");
        }
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

      // Update last activity only when someone is potentially speaking OR the creator is present
      if (speakingCandidates.length > 0 || creatorPresent) {
        lastActivityBySession.set(sessionId, Date.now());
        log.debug(
          { members: members.size, speakingLike: speakingCandidates.length, creatorPresent },
          "Speaking-like activity OR creator present; lastActivity updated"
        );
      } else {
        log.debug(
          { members: members.size, speakingLike: speakingCandidates.length, creatorPresent },
          "No speaking-like activity or creator not present; lastActivity NOT updated"
        );
      }

      // Bump group-level activity whenever anyone is speaking-like in any VC of this group
      if (speakingCandidates.length > 0) {
        lastGroupActivityByRoot.set(rootId, Date.now());
        rootInactivityNotified.delete(rootId);
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
    prevMemberNamesBySession.delete(sessionId);
    const log = childLogger({ mod: "eventTrack", sessionId });
    log.debug("Stopped session tracker");
    // Determine the root group for this session
    const rootId = sessionToRoot.get(sessionId) ?? sessionId;
    sessionToRoot.delete(sessionId);
    // If no other sessions in this root group are active, clear the group inactivity watcher
    const anyOthers = Array.from(activeTimers.keys()).some(sid => sid !== sessionId && (sessionToRoot.get(sid) ?? sid) === rootId);
    if (!anyOthers) {
      const watcher = inactivityWatchers.get(rootId);
      if (watcher) {
        clearInterval(watcher);
        inactivityWatchers.delete(rootId);
      }
      lastGroupActivityByRoot.delete(rootId);
      rootChannelIdByRoot.delete(rootId);
    }
    lastActivityBySession.delete(sessionId);
  }
}
