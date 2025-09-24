import type { ChatInputCommandContext, CommandData } from "commandkit";
import { ChannelType, MessageFlags, VoiceChannel, StageChannel, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "@workspace/db";
import { startSessionTracker, stopSessionTracker } from "../../services/sessionTracker";
import { forInteraction as loggerForInteraction } from "@workspace/logger";
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
          name: "description",
          description: "Description to store on the event and use for awarded merits (5–255 chars)",
          type: 3, // STRING
          required: true,
          min_length: 5,
          max_length: 255,
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
  const log = loggerForInteraction(interaction).child({ mod: "event", sub });

  // Support running from a voice channel or a text/thread channel in the same category
  const channel = interaction.channel;
  if (!channel) {
    log.warn("No interaction.channel; replying with error");
    return interaction.reply({ content: "Couldn't resolve the channel for this command.", flags: MessageFlags.Ephemeral });
  }

  // Try to find a related voice channel. Simple heuristics:
  // 1) If in a thread, use its parent text channel
  // 2) Look for an active voice channel in the same category
  const guild = interaction.guild;
  if (!guild) {
    log.warn("No guild on interaction; replying with error");
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
      log.warn("No MeritType rows found; prompting user to populate");
      return interaction.reply({ content: 'No MeritType entries exist. Please populate MeritType first.', flags: MessageFlags.Ephemeral });
    }
    // Read chosen merit type (by name or id)
    const meritTypeInput = interaction.options.getString('merit_type', true);
    const chosen = types.find(t => t.name === meritTypeInput || String(t.id) === meritTypeInput);
    if (!chosen) {
      log.warn({ input: meritTypeInput }, "Invalid merit type selection");
      const names = types.slice(0, 25).map(t => t.name).join(', ');
      return interaction.reply({ content: `Invalid merit type. Valid: ${names}${types.length > 25 ? ' …' : ''}`, flags: MessageFlags.Ephemeral });
    }

    // Optional voice channel argument
    const argChannel = interaction.options.getChannel("channel", false) as any | null;
    if (argChannel) {
      if (argChannel.type === ChannelType.GuildVoice || argChannel.type === ChannelType.GuildStageVoice) {
        targetVcId = argChannel.id as string;
      } else {
        log.warn({ argType: argChannel.type }, "Non-voice channel provided to 'channel' option");
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
        log.warn({ targetVcId, existingId: existing.id }, "Duplicate active session for channel");
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
      log.warn("Unable to resolve a target voice channel for start");
      return interaction.reply({
        content: "Couldn't resolve a voice channel. Run this in the voice channel (or its text channel) or pass the 'channel' option.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const descOptRaw = interaction.options.getString('description', true) || '';
    const descOpt = descOptRaw.trim().slice(0, 255);
    if (descOpt.length < 5) {
      log.warn("Description shorter than minimum length");
      return interaction.reply({ content: 'Description must be at least 5 characters long.', flags: MessageFlags.Ephemeral });
    }
    const session = await prisma.eventSession.create({
      data: {
        guildId: guild.id,
        channelId: targetVcId,
        startedBy: interaction.user.id,
        meritTypeId: chosen.id,
        awardDescription: descOpt,
      },
    });
    log.debug({ userId: interaction.user.id, guildId: guild.id, channelId: targetVcId, sessionId: session.id, meritType: chosen.name }, "event.start created");
    startSessionTracker(client, session.id, guild.id, targetVcId);
    return interaction.reply({ content: `Started tracking in <#${targetVcId}> with merit type "${chosen.name}" (session ${session.id}).\nDescription: ${descOpt}`, flags: MessageFlags.Ephemeral });
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
        log.warn({ argType: addArgChannel.type }, "Non-voice channel provided to add-vc 'channel' option");
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
        log.warn("Missing ManageChannels for channel creation");
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

      // Compute default name when none provided: "<root-name>-subN" where N is next available number among siblings
      let computedName: string | undefined = nameOpt;
      if (!computedName) {
        const baseName: string = (rootChan && (rootChan as any).name) ? String((rootChan as any).name) : "Event";
        const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const suffixRegex = new RegExp(`^${escapeRe(baseName)}-sub(\\d+)$`);
        let nextIdx = 1;
        // Limit search to the same parent (category) if available; else scan all voice/stage in guild
        const candidates = guild.channels.cache.filter(c =>
          (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
          && (parentId ? ((c as any).parentId === parentId) : true)
          && typeof (c as any).name === 'string'
        );
        candidates.forEach(c => {
          const nm = String((c as any).name);
          const m = nm.match(suffixRegex);
          if (m && m[1]) {
            const n = parseInt(m[1], 10);
            if (!Number.isNaN(n) && n >= nextIdx) nextIdx = n + 1;
          }
        });
        const suffix = `-sub${nextIdx}`;
        const maxLen = 100; // Discord channel name limit
        const maxBaseLen = Math.max(1, maxLen - suffix.length);
        computedName = `${baseName.slice(0, maxBaseLen)}${suffix}`;
      }

      try {
        const created = await guild.channels.create({
          name: computedName!,
          type: newType,
          parent: parentId,
          permissionOverwrites,
        } as any);
        createdChannel = created as any;
        finalVcId = (created as any).id as string;
      } catch (e: any) {
        log.error({ err: e, parentId, computedName, type: newType }, "Failed to create voice channel");
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
        log.warn({ finalVcId, existingId: existing.id, rootId }, "Channel already part of current event");
        return interaction.reply({ content: `That channel <#${finalVcId}> is already part of this event (session ${existing.id}).`, flags: MessageFlags.Ephemeral });
      }
      log.warn({ finalVcId, existingRootId, rootId }, "Channel tracked in a different event");
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
      log.warn({ argType: stopArgChannel.type }, "Non-voice channel provided to stop 'channel' option");
      return interaction.reply({ content: "Please choose a voice or stage channel for the 'channel' option.", flags: MessageFlags.Ephemeral });
    }
  }

  if (!targetVcId) {
    log.warn("Couldn't resolve a voice channel for stop");
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
    log.warn({ channelId: targetVcId }, "No active session found for this channel");
    return interaction.reply({ content: "No active session found for this channel.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Determine root session and present confirmation UI (do NOT end yet)
  const root = active.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`eventclose:confirm:${root!.id}:${interaction.user.id}`).setLabel("Close w/Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`eventclose:nomerits:${root!.id}:${interaction.user.id}`).setLabel("Close w/No Merits").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eventclose:cancel:${root!.id}:${interaction.user.id}`).setLabel("Cancel").setStyle(ButtonStyle.Danger),
  );
  await interaction.editReply({ content: `You're about to close session ${root!.id} in <#${root!.channelId}>. Closing will stop tracking. Proceed?`, components: [row] });
  return;
}
