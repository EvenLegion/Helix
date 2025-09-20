import type { ChatInputCommandContext, CommandData } from "commandkit";
import { ChannelType, MessageFlags, VoiceChannel, StageChannel } from "discord.js";
import { prisma } from "@workspace/db";
import { startSessionTracker, stopSessionTracker } from "../../services/sessionTracker";
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
          name: "channel",
          description: "Voice channel to track (optional)",
          type: 7, // CHANNEL
          channel_types: [2, 13], // GuildVoice, GuildStageVoice
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
  if (sub !== "start" && sub !== "stop") return;

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
      },
    });
    console.log(`[EventTrack] /event start by @${interaction.user.tag} (${interaction.user.id}) in guild ${guild.id} for channel ${targetVcId} -> session ${session.id}`);
    startSessionTracker(client, session.id, guild.id, targetVcId);
    return interaction.reply({ content: `Started tracking in <#${targetVcId}> (session ${session.id}).`, flags: MessageFlags.Ephemeral });
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
  await prisma.eventSession.update({ where: { id: active.id }, data: { endedAt: new Date(), status: "ENDED" } });
  stopSessionTracker(active.id);
  console.log(`[EventTrack] /event stop by @${interaction.user.tag} (${interaction.user.id}) in guild ${guild.id} for channel ${targetVcId} -> session ${active.id}`);

  // Fetch participants sorted by speaking time desc
  const session = await prisma.eventSession.findUnique({ where: { id: active.id } });
  const participants = await prisma.eventSessionParticipant.findMany({
    where: { eventSessionId: active.id },
    orderBy: { totalSecondsPresent: "desc" },
  });

  const startedAt = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const endedAt = session?.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const sessionSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));

  // Initialize review state defaults (merit if presence >= 20% of session)
  const key = getReviewStateKey(active.id, interaction.user.id);
  const defaults = new Map<string, "merit" | "demerit" | "none">();
  for (const p of participants) {
    const meritDefault = (p.totalSecondsPresent / sessionSeconds) >= 0.2 ? "merit" : "none";
    defaults.set((p.userId || '').trim(), meritDefault);
  }
  upsertReviewState(key, defaults);

  // Build name map using DB users (faster than Discord fetch for large sets)
  // Build name map from DB first (fast), then override with guild display names for the first page
  const userIds = participants.map(p => (p.userId || '').trim());
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
    const pageIds = participants.slice(0, PAGE_SIZE).map(p => (p.userId || '').trim());
    if (pageIds.length) {
      const t1 = Date.now();
      const fetched = await guild.members.fetch({ user: pageIds, withPresences: false });
      console.log(`[EventReview] Guild fetch page0: fetched ${fetched.size}/${pageIds.length} in ${Date.now() - t1}ms`);
      fetched.forEach(m => {
        nameMap.set(m.id, m.displayName || m.user.username || m.id);
      });
      // cache page 0
      setPageNames(active.id, 0, nameMap);
      const preview = participants.slice(0, PAGE_SIZE).map(p => {
        const uid = (p.userId || '').trim();
        return [uid, nameMap.get(uid)];
      });
      console.log(`[EventReview] Page 0 labels:`, preview);
    }
  } catch {
    // ignore fetch errors; placeholders still show DB/cached names
  }

  const page = 0;
  const message = buildEventReviewMessage({
    sessionId: active.id,
    channelId: targetVcId,
    sessionSeconds,
    participants,
    page,
    reviewerId: interaction.user.id,
    nameMap,
  });
  await interaction.editReply(message);
  return;
}
