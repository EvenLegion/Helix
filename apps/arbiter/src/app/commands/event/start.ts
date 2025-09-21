import type { ChatInputCommandContext, CommandData } from "commandkit";
import { ChannelType, MessageFlags, VoiceChannel, StageChannel, PermissionsBitField } from "discord.js";
import { prisma } from "@workspace/db";
import { startSessionTracker, stopSessionTracker } from "../../services/sessionTracker";
import { startChannelCleanupWatcher } from "../../services/channelCleanup";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { setPageNames } from "../../services/nameCache.ts";
import { upsertReviewState, getReviewStateKey } from "../../services/reviewStore.ts";

export const command: CommandData = {
  name: "event",
  description: "Event controls",
  options: [
    {
      name: "start",
      description: "Start tracking participation for this voice channel",
      type: 1, // Subcommand
      options: [
        {
          name: "merit_type",
          description: "Merit type to apply for this event",
          type: 3, // STRING
          required: true,
          autocomplete: true,
        },
        {
          name: "channel",
          description: "Voice channel to track (optional)",
          type: 7, // CHANNEL
          channel_types: [2, 13], // GuildVoice, GuildStageVoice
          required: false,
        },
      ],
    },
    {
      name: "add-vc",
      description: "Add or link another voice channel to the current event",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Existing voice/stage channel to add (optional)",
          type: 7, // CHANNEL
          channel_types: [2, 13],
          required: false,
        },
        {
          name: "name",
          description: "If creating a new voice channel, the name to use",
          type: 3, // STRING
          required: false,
        },
      ],
    },
    {
      name: "stop",
      description: "Stop tracking for this voice channel",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Voice channel to stop tracking (optional)",
          type: 7, // CHANNEL
          channel_types: [2, 13], // GuildVoice, GuildStageVoice
          required: false,
        },
      ],
    },
  ],
};

export async function chatInput({ interaction, client }: ChatInputCommandContext) {
  const sub = interaction.options.getSubcommand();
  if (sub !== "start" && sub !== "stop" && sub !== "add-vc") return;

  // Support running from a voice channel or a text/thread channel in the same category
  const channel = interaction.channel;
  if (!channel) {
    return interaction.reply({ content: "Couldn't resolve the channel for this command.", flags: MessageFlags.Ephemeral });
  }

  // Try to find a related voice channel. Simple heuristics:
  // 1) If in a thread, use its parent text channel
  // 2) Look for an active voice channel in the same category
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
  }

  // If invoked inside a voice/stage channel, track that channel directly
  let targetVcId: string | null = null;
  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
    targetVcId = (channel as any).id as string;
  } else {
    // Otherwise, resolve category id from the current channel or its parent (if thread) and find a VC in that category
    let categoryId: string | null = null;
    const anyChannel = channel as any;
    if (typeof anyChannel.isThread === "function" && anyChannel.isThread()) {
      const parent = anyChannel.parent as any;
      if (parent && parent.type === ChannelType.GuildText) {
        categoryId = parent.parentId ?? null;
      }
    } else if (channel.type === ChannelType.GuildText) {
      categoryId = (channel as any).parentId ?? null;
    }
    if (categoryId) {
      const relatedVc = guild.channels.cache.find(c =>
        (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && (c as any).parentId === categoryId
      ) as VoiceChannel | StageChannel | undefined;
      if (relatedVc) targetVcId = (relatedVc as any).id as string;
    }
  }

  // Note: do not early-return here; each subcommand will handle missing targetVcId with better guidance

  if (sub === "start") {
    // Load MeritType choices for validation/display
    const types = await prisma.meritType.findMany({ orderBy: { id: 'asc' } });
    if (!types.length) {
      return interaction.reply({ content: 'No MeritType entries exist. Please populate MeritType first.', flags: MessageFlags.Ephemeral });
    }
    // Read chosen merit type (by name or id)
    const meritTypeInput = interaction.options.getString('merit_type', true);
    const chosen = types.find(t => t.name === meritTypeInput || String(t.id) === meritTypeInput);
    if (!chosen) {
      const names = types.slice(0, 25).map(t => t.name).join(', ');
      return interaction.reply({ content: `Invalid merit type. Valid: ${names}${types.length > 25 ? ' …' : ''}`, flags: MessageFlags.Ephemeral });
    }

    // Optional voice channel argument
    const argChannel = interaction.options.getChannel("channel", false) as any | null;
    if (argChannel) {
      if (argChannel.type === ChannelType.GuildVoice || argChannel.type === ChannelType.GuildStageVoice) {
        targetVcId = argChannel.id as string;
      } else {
        return interaction.reply({ content: "Please choose a voice or stage channel for the 'channel' option.", flags: MessageFlags.Ephemeral });
      }
    }

    // Prevent duplicate active sessions for the same channel
    if (targetVcId) {
      const existing = await prisma.eventSession.findFirst({
        where: { guildId: guild.id, channelId: targetVcId, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (existing) {
        return interaction.reply({ content: `A session is already active for <#${targetVcId}> (session ${existing.id}).`, flags: MessageFlags.Ephemeral });
      }
    }

    // If still no target from arg, use current channel or category heuristic
    if (!targetVcId) {
      if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        targetVcId = (channel as any).id as string;
      } else {
        let categoryId: string | null = null;
        const anyChannel = channel as any;
        if (typeof anyChannel.isThread === "function" && anyChannel.isThread()) {
          const parent = anyChannel.parent as any;
          if (parent && parent.type === ChannelType.GuildText) {
            categoryId = parent.parentId ?? null;
          }
        } else if (channel.type === ChannelType.GuildText) {
          categoryId = (channel as any).parentId ?? null;
        }
        if (categoryId) {
          const relatedVc = guild.channels.cache.find(c =>
            (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && (c as any).parentId === categoryId
          ) as VoiceChannel | StageChannel | undefined;
          if (relatedVc) targetVcId = (relatedVc as any).id as string;
        }
      }
    }

    if (!targetVcId) {
      return interaction.reply({
        content: "Couldn't resolve a voice channel. Run this in the voice channel (or its text channel) or pass the 'channel' option.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const session = await prisma.eventSession.create({
      data: {
        guildId: guild.id,
        channelId: targetVcId,
        startedBy: interaction.user.id,
        meritTypeId: chosen.id,
      },
    });
    console.log(`[EventTrack] /event start by @${interaction.user.tag} (${interaction.user.id}) in guild ${guild.id} for channel ${targetVcId} meritType=${chosen.name} -> session ${session.id}`);
    startSessionTracker(client, session.id, guild.id, targetVcId);
    return interaction.reply({ content: `Started tracking in <#${targetVcId}> with merit type "${chosen.name}" (session ${session.id}).`, flags: MessageFlags.Ephemeral });
  }

  if (sub === "add-vc") {
    // Determine the root session to attach to
    // Strategy:
    // 1) If the current channel (or its related VC) has an active session, use that as root
    // 2) Else if exactly one ACTIVE session exists in the guild, use it
    // 3) Otherwise, ask for disambiguation

    // Try to resolve a VC from context (similar heuristic to start)
    let contextVcId: string | null = null;
    if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
      contextVcId = (channel as any).id as string;
    } else {
      let categoryId: string | null = null;
      const anyChannel = channel as any;
      if (typeof anyChannel.isThread === "function" && anyChannel.isThread()) {
        const parent = anyChannel.parent as any;
        if (parent && parent.type === ChannelType.GuildText) {
          categoryId = parent.parentId ?? null;
        }
      } else if (channel.type === ChannelType.GuildText) {
        categoryId = (channel as any).parentId ?? null;
      }
      if (categoryId) {
        const relatedVc = guild.channels.cache.find(c =>
          (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && (c as any).parentId === categoryId
        ) as VoiceChannel | StageChannel | undefined;
        if (relatedVc) contextVcId = (relatedVc as any).id as string;
      }
    }

    // If the user specified an existing channel to add, that's the target to add.
    const addArgChannel = interaction.options.getChannel("channel", false) as any | null;
    let addTargetVcId: string | null = null;
    if (addArgChannel) {
      if (addArgChannel.type === ChannelType.GuildVoice || addArgChannel.type === ChannelType.GuildStageVoice) {
        addTargetVcId = addArgChannel.id as string;
      } else {
        return interaction.reply({ content: "Please choose a voice or stage channel for the 'channel' option.", flags: MessageFlags.Ephemeral });
      }
    }

    // Find candidate root based on context VC if available
    let root: any | null = null;
    if (contextVcId) {
      const ctxActive = await prisma.eventSession.findFirst({
        where: { guildId: guild.id, channelId: contextVcId, endedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (ctxActive) root = ctxActive.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: ctxActive.rootSessionId } }) : ctxActive;
    }
    if (!root) {
      const actives = await prisma.eventSession.findMany({ where: { guildId: guild.id, endedAt: null }, orderBy: { startedAt: "desc" } });
      if (actives.length === 1) {
        const only = actives[0]!;
        root = only.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: only.rootSessionId } }) : only;
      }
    }
    if (!root) {
      return interaction.reply({ content: "Couldn't determine which event to add this VC to. Run this from a tracked channel or ensure only one event is active.", flags: MessageFlags.Ephemeral });
    }

    // Determine final VC to add: use provided existing channel, or create a new one
    let finalVcId: string | null = addTargetVcId;
    let createdChannel: VoiceChannel | StageChannel | null = null;
    if (!finalVcId) {
      // Permission pre-check: Manage Channels required
      const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
      if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({
          content: "I don't have permission to create channels. Please grant 'Manage Channels' (or 'Administrator') to my role, or pass an existing channel via the 'channel' option.",
          flags: MessageFlags.Ephemeral,
        });
      }
      const nameOpt = interaction.options.getString("name", false) || undefined;
      // Create under same category as the root channel if possible
      const rootChan = guild.channels.cache.get(root.channelId) ?? await guild.channels.fetch(root.channelId).catch(() => null);
      let parentId = (rootChan && (rootChan as any).parentId) ? (rootChan as any).parentId as string : undefined;
      // If parent category exists but denies Manage Channels, fall back to guild root
      if (parentId) {
        const parent = guild.channels.cache.get(parentId) ?? await guild.channels.fetch(parentId).catch(() => null);
        const canManageInParent = parent && 'permissionsFor' in parent && (parent as any).permissionsFor(me)?.has(PermissionsBitField.Flags.ManageChannels);
        if (!canManageInParent) {
          parentId = undefined;
        }
      }
      // Copy permission overwrites from the root channel
      const permissionOverwrites = (rootChan && (rootChan as any).permissionOverwrites?.cache)
        ? Array.from((rootChan as any).permissionOverwrites.cache.values()).map((o: any) => ({
          id: o.id,
          allow: o.allow,
          deny: o.deny,
          type: o.type, // role|member
        }))
        : undefined;
      // Match type to root channel (voice vs stage); default to voice
      const newType = (rootChan && (rootChan as any).type === ChannelType.GuildStageVoice)
        ? ChannelType.GuildStageVoice
        : ChannelType.GuildVoice;

      try {
        const created = await guild.channels.create({
          name: nameOpt || "Event VC",
          type: newType,
          parent: parentId,
          permissionOverwrites,
        } as any);
        createdChannel = created as any;
        finalVcId = (created as any).id as string;
      } catch (e: any) {
        const code = (e && typeof e.code !== 'undefined') ? ` (code ${e.code})` : '';
        const hint = e?.code === 50013
          ? "I need 'Manage Channels' permission, or use /event add-vc with the 'channel' option to attach an existing channel."
          : "Please ensure I have 'Manage Channels' or try attaching an existing channel with the 'channel' option.";
        return interaction.reply({ content: `Failed to create a voice channel${code}: ${String(e?.message || e)}\n${hint}`.trim(), flags: MessageFlags.Ephemeral });
      }
    }

    if (!finalVcId) {
      return interaction.reply({ content: "Couldn't resolve or create a voice channel to add.", flags: MessageFlags.Ephemeral });
    }

    // Prevent duplicate active session for that channel
    const existing = await prisma.eventSession.findFirst({ where: { guildId: guild.id, channelId: finalVcId, endedAt: null } });
    if (existing) {
      const existingRootId = existing.rootSessionId ?? existing.id;
      const rootId = root.id;
      if (existingRootId === rootId) {
        return interaction.reply({ content: `That channel <#${finalVcId}> is already part of this event (session ${existing.id}).`, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: `That channel <#${finalVcId}> is already being tracked for a different event (session ${existingRootId}).`, flags: MessageFlags.Ephemeral });
    }

    // Inherit merit type from root
    const child = await prisma.eventSession.create({
      data: {
        rootSessionId: root.id,
        guildId: guild.id,
        channelId: finalVcId,
        startedBy: interaction.user.id,
        createdByBot: createdChannel ? true : false,
        meritTypeId: root.meritTypeId ?? undefined,
      },
    });
    startSessionTracker(client, child.id, guild.id, finalVcId);
    const createdSuffix = createdChannel ? " (created new channel)" : "";
    return interaction.reply({ content: `Added <#${finalVcId}> to event (root session ${root.id}) as session ${child.id}${createdSuffix}.`, flags: MessageFlags.Ephemeral });
  }

  // stop
  // Optional voice channel argument for stop
  const stopArgChannel = interaction.options.getChannel("channel", false) as any | null;
  if (stopArgChannel) {
    if (stopArgChannel.type === ChannelType.GuildVoice || stopArgChannel.type === ChannelType.GuildStageVoice) {
      targetVcId = stopArgChannel.id as string;
    } else {
      return interaction.reply({ content: "Please choose a voice or stage channel for the 'channel' option.", flags: MessageFlags.Ephemeral });
    }
  }

  if (!targetVcId) {
    return interaction.reply({
      content: "Couldn't resolve a voice channel. Run this in the voice channel (or its text channel) or pass the 'channel' option.",
      flags: MessageFlags.Ephemeral,
    });
  }
  const active = await prisma.eventSession.findFirst({
    where: { guildId: guild.id, channelId: targetVcId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!active) {
    return interaction.reply({ content: "No active session found for this channel.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Determine group (root + any children)
  const root = active.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
  const groupSessions = await prisma.eventSession.findMany({
    where: {
      OR: [
        { id: root!.id },
        { rootSessionId: root!.id },
      ],
      endedAt: null,
    },
    orderBy: { startedAt: "asc" },
  });

  // End all sessions in group and stop trackers
  const now = new Date();
  const endIds = groupSessions.map(s => s.id);
  if (endIds.length) {
    await prisma.eventSession.updateMany({ where: { id: { in: endIds } }, data: { endedAt: now, status: "ENDED" } });
    for (const id of endIds) stopSessionTracker(id);
  }
  console.log(`[EventTrack] /event stop by @${interaction.user.tag} (${interaction.user.id}) in guild ${guild.id} for group root ${root!.id} -> ended ${endIds.length} session(s)`);

  // Start cleanup watchers for bot-created channels (delete when empty)
  const endedWithMeta = await prisma.eventSession.findMany({ where: { id: { in: endIds } } });
  for (const s of endedWithMeta) {
    if (s.createdByBot) {
      try {
        startChannelCleanupWatcher(client, s.guildId, s.channelId);
      } catch (e) {
        console.warn(`[EventTrack] Cleanup watcher failed for channel ${s.channelId}:`, e);
      }
    }
  }

  // Aggregate participants across the ended sessions, write into root's participants
  const allParticipants = await prisma.eventSessionParticipant.findMany({
    where: { eventSessionId: { in: endIds } },
  });
  const byUser = new Map<string, { present: number; speaking: number; lastJoinAt?: Date | null; lastSpeakAt?: Date | null }>();
  for (const p of allParticipants) {
    const cur = byUser.get(p.userId) || { present: 0, speaking: 0, lastJoinAt: null, lastSpeakAt: null };
    cur.present += p.totalSecondsPresent;
    cur.speaking += p.totalSecondsSpeaking;
    if (!cur.lastJoinAt || (p.lastJoinAt && p.lastJoinAt > cur.lastJoinAt)) cur.lastJoinAt = p.lastJoinAt;
    if (!cur.lastSpeakAt || (p.lastSpeakAt && p.lastSpeakAt > cur.lastSpeakAt)) cur.lastSpeakAt = p.lastSpeakAt;
    byUser.set(p.userId, cur);
  }
  // Upsert into root session's participants
  for (const [uid, agg] of byUser) {
    await prisma.eventSessionParticipant.upsert({
      where: { eventSessionId_userId: { eventSessionId: root!.id, userId: uid } },
      create: {
        eventSessionId: root!.id,
        userId: uid,
        totalSecondsPresent: agg.present,
        totalSecondsSpeaking: agg.speaking,
        lastJoinAt: agg.lastJoinAt ?? undefined,
        lastSpeakAt: agg.lastSpeakAt ?? undefined,
      },
      update: {
        totalSecondsPresent: agg.present,
        totalSecondsSpeaking: agg.speaking,
        lastJoinAt: agg.lastJoinAt ?? undefined,
        lastSpeakAt: agg.lastSpeakAt ?? undefined,
      },
    });
  }

  // Fetch participants sorted by presence time desc for review, using root only
  const session = await prisma.eventSession.findUnique({ where: { id: root!.id } });
  const participants = await prisma.eventSessionParticipant.findMany({
    where: { eventSessionId: root!.id },
    orderBy: { totalSecondsPresent: "desc" },
  });

  // Group session duration: min(startedAt) to max(endedAt) across all group sessions
  const endedGroup = await prisma.eventSession.findMany({ where: { id: { in: endIds } }, orderBy: { startedAt: "asc" } });
  const startedAtMs = endedGroup.length ? Math.min(...endedGroup.map(s => new Date(s.startedAt).getTime())) : (session?.startedAt ? new Date(session.startedAt).getTime() : Date.now());
  const endedAtMs = endedGroup.length ? Math.max(...endedGroup.map(s => new Date(s.endedAt ?? now).getTime())) : (session?.endedAt ? new Date(session.endedAt).getTime() : Date.now());
  const sessionSeconds = Math.max(1, Math.floor((endedAtMs - startedAtMs) / 1000));

  // Initialize review state defaults (merit if presence >= 20% of session)
  const key = getReviewStateKey(root!.id, interaction.user.id);
  const defaults = new Map<string, "merit" | "none">();
  for (const p of participants) {
    const meritDefault = (p.totalSecondsPresent / sessionSeconds) >= 0.2 ? "merit" : "none";
    defaults.set(p.userId, meritDefault);
  }
  upsertReviewState(key, defaults);

  // Build name map using DB users (faster than Discord fetch for large sets)
  // Build name map from DB first (fast), then override with guild display names for the first page
  const userIds = participants.map(p => p.userId);
  if (process.env.EVENT_REVIEW_DEBUG_NAMES === '1') {
    console.log(`[EventReview] Querying userIds (first 50 of ${userIds.length}):`, userIds.slice(0, 50));
    try {
      const snapshot = await prisma.user.findMany({
        select: { id: true, nickname: true, name: true, username: true },
        take: 50,
        orderBy: { id: 'asc' },
      });
      console.log(`[EventReview] DB users snapshot (max 50):`, snapshot);
    } catch (e) {
      console.log(`[EventReview] Failed to fetch DB users snapshot:`, e);
    }
  }
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const t0 = Date.now();
    const rows = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, name: true, username: true },
    });
    console.log(`[EventReview] DB name lookup: ${rows.length} rows for ${userIds.length} ids in ${Date.now() - t0}ms`);
    console.log(`[EventReview] DB rows (stop):`, rows);
    const foundIds = new Set(rows.map(r => r.id));
    const missing = userIds.filter(id => !foundIds.has(id));
    if (missing.length) {
      console.log(`[EventReview] DB missing ids (${missing.length}):`, missing.slice(0, 10), missing.length > 10 ? '…' : '');
    }
    for (const r of rows) {
      const disp = r.nickname || r.name || r.username || r.id;
      nameMap.set(r.id, disp);
    }
    const dbPreview = rows.map(r => [r.id, nameMap.get(r.id)]);
    console.log(`[EventReview] DB nameMap (stop):`, dbPreview);

    // Opportunistic backfill for missing users (opt-in via EVENT_REVIEW_BACKFILL=1)
    if (missing.length && process.env.EVENT_REVIEW_BACKFILL === '1') {
      try {
        const tbf = Date.now();
        const fetchedMissing = await guild.members.fetch({ user: missing, withPresences: false });
        console.log(`[EventReview] Backfill fetch: got ${fetchedMissing.size}/${missing.length} in ${Date.now() - tbf}ms`);
        const upserts: Promise<any>[] = [];
        fetchedMissing.forEach(m => {
          const profile = {
            id: m.id,
            username: m.user.username ?? null,
            nickname: m.nickname ?? null,
            name: m.displayName ?? null,
            image: m.user.displayAvatarURL ? m.user.displayAvatarURL() : null,
          };
          upserts.push(
            prisma.user.upsert({
              where: { id: profile.id },
              update: {
                username: profile.username ?? undefined,
                nickname: profile.nickname ?? undefined,
                name: profile.name ?? undefined,
                image: profile.image ?? undefined,
              },
              create: {
                id: profile.id,
                username: profile.username,
                nickname: profile.nickname,
                name: profile.name,
                image: profile.image,
              },
            })
          );
        });
        if (upserts.length) {
          await Promise.allSettled(upserts);
          console.log(`[EventReview] Backfilled ${upserts.length} users into DB`);
        }
      } catch (e) {
        console.warn(`[EventReview] Backfill failed`, e);
      }
    }
  }
  // Fallback to caches for any missing
  for (const uid of userIds) {
    if (!nameMap.has(uid)) {
      const m = guild.members.cache.get(uid);
      if (m) nameMap.set(uid, m.displayName || m.user?.username || uid);
    }
    if (!nameMap.has(uid)) {
      const u = client.users.cache.get(uid);
      if (u) nameMap.set(uid, u.username);
    }
    if (!nameMap.has(uid)) nameMap.set(uid, uid);
  }

  // Override with true guild display names for the first page (max 4 fetch to match UI)
  try {
    const PAGE_SIZE = 4;
    const pageIds = participants.slice(0, PAGE_SIZE).map(p => p.userId);
    if (pageIds.length) {
      const t1 = Date.now();
      const fetched = await guild.members.fetch({ user: pageIds, withPresences: false });
      console.log(`[EventReview] Guild fetch page0: fetched ${fetched.size}/${pageIds.length} in ${Date.now() - t1}ms`);
      fetched.forEach(m => {
        nameMap.set(m.id, m.displayName || m.user.username || m.id);
      });
      // cache page 0
      setPageNames(root!.id, 0, nameMap);
      const preview = participants.slice(0, PAGE_SIZE).map(p => {
        const uid = p.userId;
        return [uid, nameMap.get(uid)];
      });
      console.log(`[EventReview] Page 0 labels:`, preview);
    }
  } catch {
    // ignore fetch errors; placeholders still show DB/cached names
  }

  const page = 0;
  const message = buildEventReviewMessage({
    sessionId: root!.id,
    channelId: root!.channelId,
    sessionSeconds,
    participants,
    page,
    reviewerId: interaction.user.id,
    nameMap,
  });
  await interaction.editReply(message);
  return;
}
