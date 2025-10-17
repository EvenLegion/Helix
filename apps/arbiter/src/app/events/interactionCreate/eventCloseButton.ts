import { ButtonInteraction, Client, MessageFlags, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction as loggerForInteraction } from "@workspace/logger";
import { stopSessionTracker } from "../../services/sessionTracker";
import { getNotifyInfo, clearNotifyInfo } from "../../services/notifyStore";
import { startChannelCleanupWatcher } from "../../services/channelCleanup";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { upsertReviewState, getReviewStateKey } from "../../services/reviewStore.ts";
import { getMeritMinSpeakingPct, getMeritMinPresentPct, getMeritMinPresentPctOverride, getMeritMinSpeakingPctOverride } from "../../services/eventConfig";
import { ensureUsersByIds } from "../../utils/ensureUsers";

// Mirror the Centurion requirement used by /event middleware (with admin bypass)
const CENTURION_ROLE_ID = "1352378365809786970";

// Helper to resolve a guild role by one of several candidate names
function findRoleByNames(guild: any, names: string[]) {
  try {
    for (const name of names) {
      const role = guild.roles?.cache?.find((r: any) => r.name === name);
      if (role) return role;
    }
  } catch { }
  return null;
}

export default async function (interaction: ButtonInteraction, client: Client) {
  if (!interaction.isButton()) return;
  const id = interaction.customId || "";
  const isStart = id.startsWith("event:close:");
  const isFlow = id.startsWith("eventclose:");
  if (!isStart && !isFlow) return;

  const log = loggerForInteraction(interaction).child({ mod: "event", action: "close-button" });
  // Route: initial click => show confirmation; flow clicks => perform the chosen action
  if (isStart) {
    const parts = id.split(":");
    const sessionId = Number(parts[2]);
    if (!Number.isFinite(sessionId)) {
      return interaction.reply({ content: "Invalid session id.", flags: MessageFlags.Ephemeral });
    }
    // Verify exists and active but DO NOT stop yet
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!active) {
      return interaction.reply({ content: `Session ${sessionId} not found.`, flags: MessageFlags.Ephemeral });
    }
    if (active.endedAt) {
      return interaction.reply({ content: `Session ${sessionId} is already ended.`, flags: MessageFlags.Ephemeral });
    }

    // Permission: Admin, Centurion, Admiral, Imperator, or the event creator (root.startedBy)
    let isAdmin = false, isCenturion = false, isAdmiral = false, isImperator = false, isCreator = false;
    try {
      const root = active.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
      const guild = await interaction.client.guilds.fetch(root!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      const admirals = findRoleByNames(guild, ["Admirallus (Admiral)", "Admiral", "Admirallus"]);
      const imperators = findRoleByNames(guild, ["Imperator (Commander)", "Imperator", "Commander"]);
      isAdmiral = admirals ? Boolean(member.roles?.cache?.has?.(admirals.id)) : false;
      isImperator = imperators ? Boolean(member.roles?.cache?.has?.(imperators.id)) : false;
      isCreator = root?.startedBy === interaction.user.id;
    } catch { /* leave flags false if fetch fails */ }
    if (!(isAdmin || isCenturion || isAdmiral || isImperator || isCreator)) {
      return interaction.reply({ content: "You don't have permission to close events.", flags: MessageFlags.Ephemeral });
    }

    const reviewerId = interaction.user.id;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`eventclose:confirm:${sessionId}:${reviewerId}`).setLabel("Close w/Confirm").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eventclose:nomerits:${sessionId}:${reviewerId}`).setLabel("Close w/No Merits").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`eventclose:cancel:${sessionId}:${reviewerId}`).setLabel("Cancel").setStyle(ButtonStyle.Danger),
    );
    return interaction.reply({
      content: `You're about to close session ${sessionId} in <#${active.channelId}>. Closing will stop tracking. Proceed?\n\nNote: Cancel keeps the event running.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Flow actions: confirm / no-merits / cancel
  const parts = id.split(":");
  const action = parts[1]; // confirm | nomerits | cancel
  const sessionId = Number(parts[2]);
  const reviewerId = parts[3];
  if (!Number.isFinite(sessionId) || !reviewerId || reviewerId !== interaction.user.id) {
    return interaction.reply({ content: "This action can only be performed by the moderator who initiated it.", flags: MessageFlags.Ephemeral });
  }

  // Acknowledge immediately to avoid 3s timeout leading to Unknown interaction
  try { await interaction.deferUpdate(); } catch { /* ignore if already acknowledged */ }

  const safeEditReply = async (data: any) => {
    try { return await interaction.editReply(data as any); } catch (e) { try { log.warn({ err: e }, "editReply failed (possibly stale interaction)"); } catch {} }
  };

  // Helper to end the event group and optionally build review state
  const endAndAggregate = async () => {
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!active) throw new Error("Session not found");
    const root = active.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
    if (!root) throw new Error("Root session not found");
    const groupSessions = await prisma.eventSession.findMany({ where: { OR: [{ id: root.id }, { rootSessionId: root.id }], endedAt: null }, orderBy: { startedAt: "asc" } });
    const now = new Date();
    const endIds = groupSessions.map(s => s.id);
    if (endIds.length) {
      await prisma.eventSession.updateMany({ where: { id: { in: endIds } }, data: { endedAt: now, status: "ENDED" } });
      for (const id of endIds) stopSessionTracker(id);
    }
    // Cleanup watchers for bot-created
    const endedWithMeta = await prisma.eventSession.findMany({ where: { id: { in: endIds } } });
    for (const s of endedWithMeta) {
      if (s.createdByBot) {
        try { startChannelCleanupWatcher(client, s.guildId, s.channelId); } catch { }
      }
    }
    // Aggregate
    const allParticipants = await prisma.eventSessionParticipant.findMany({ where: { eventSessionId: { in: endIds } } });
    const byUser = new Map<string, { present: number; speaking: number; lastJoinAt?: Date | null; lastSpeakAt?: Date | null }>();
    for (const p of allParticipants) {
      const cur = byUser.get(p.userId) || { present: 0, speaking: 0, lastJoinAt: null, lastSpeakAt: null };
      cur.present += p.totalSecondsPresent;
      cur.speaking += p.totalSecondsSpeaking;
      if (!cur.lastJoinAt || (p.lastJoinAt && p.lastJoinAt > cur.lastJoinAt)) cur.lastJoinAt = p.lastJoinAt;
      if (!cur.lastSpeakAt || (p.lastSpeakAt && p.lastSpeakAt > cur.lastSpeakAt)) cur.lastSpeakAt = p.lastSpeakAt;
      byUser.set(p.userId, cur);
    }
    // Ensure all users exist before upserting participant records
    const userIds = Array.from(byUser.keys());
    if (userIds.length > 0) {
      await ensureUsersByIds(userIds, "eventClose");
    }
    
    for (const [uid, agg] of byUser) {
      await prisma.eventSessionParticipant.upsert({
        where: { eventSessionId_userId: { eventSessionId: root.id, userId: uid } },
        create: { eventSessionId: root.id, userId: uid, totalSecondsPresent: agg.present, totalSecondsSpeaking: agg.speaking, lastJoinAt: agg.lastJoinAt ?? undefined, lastSpeakAt: agg.lastSpeakAt ?? undefined },
        update: { totalSecondsPresent: agg.present, totalSecondsSpeaking: agg.speaking, lastJoinAt: agg.lastJoinAt ?? undefined, lastSpeakAt: agg.lastSpeakAt ?? undefined },
      });
    }
    return { root, endIds } as const;
  };

  if (action === "cancel") {
    // Allow the initiator to cancel without elevated permissions
    return safeEditReply({ content: "Close cancelled. Event remains active.", components: [] });
  }

  if (action === "nomerits") {
    // Permission: Admin, Centurion, Admiral, Imperator, or event creator
    let isAdmin = false, isCenturion = false, isAdmiral = false, isImperator = false, isCreator = false;
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    const root = active?.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
    try {
      const guild = await interaction.client.guilds.fetch(root!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      const admirals = findRoleByNames(guild, ["Admirallus (Admiral)", "Admiral", "Admirallus"]);
      const imperators = findRoleByNames(guild, ["Imperator (Commander)", "Imperator", "Commander"]);
      isAdmiral = admirals ? Boolean(member.roles?.cache?.has?.(admirals.id)) : false;
      isImperator = imperators ? Boolean(member.roles?.cache?.has?.(imperators.id)) : false;
      isCreator = root?.startedBy === interaction.user.id;
    } catch { /* leave false */ }
    if (!(isAdmin || isCenturion || isAdmiral || isImperator || isCreator)) {
      return safeEditReply({ content: "You don't have permission to close events.", components: [] });
    }
    try {
      const res = await endAndAggregate();
      // Post follow-up in inactivity thread if available
      try {
        const info = getNotifyInfo(res.root.id) || getNotifyInfo(sessionId);
        if (info?.threadId) {
          const guild = await interaction.client.guilds.fetch(res.root.guildId);
          const thread = await guild.channels.fetch(info.threadId).catch(() => null as any);
          if (thread && (thread as any).isTextBased?.()) {
            await (thread as any).send(`Session ${res.root.id} has been closed with no merits assigned.`);
            clearNotifyInfo(res.root.id);
            if (res.root.id !== sessionId) clearNotifyInfo(sessionId);
          }
        }
      } catch { /* ignore follow-up errors */ }
    } catch (e: any) {
      return safeEditReply({ content: `Failed to close: ${String(e?.message || e)}`, components: [] });
    }
    return safeEditReply({ content: `Event closed. No merits awarded.`, components: [] });
  }

  if (action === "confirm") {
    // Permission: Admin, Centurion, Admiral, Imperator, or event creator
    let isAdmin = false, isCenturion = false, isAdmiral = false, isImperator = false, isCreator = false;
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    const rootForPerm = active?.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
    try {
      const guild = await interaction.client.guilds.fetch(rootForPerm!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      const admirals = findRoleByNames(guild, ["Admirallus (Admiral)", "Admiral", "Admirallus"]);
      const imperators = findRoleByNames(guild, ["Imperator (Commander)", "Imperator", "Commander"]);
      isAdmiral = admirals ? Boolean(member.roles?.cache?.has?.(admirals.id)) : false;
      isImperator = imperators ? Boolean(member.roles?.cache?.has?.(imperators.id)) : false;
      isCreator = rootForPerm?.startedBy === interaction.user.id;
    } catch { /* leave false */ }
    if (!(isAdmin || isCenturion || isAdmiral || isImperator || isCreator)) {
      return safeEditReply({ content: "You don't have permission to close events.", components: [] });
    }
    // End and then build review UI
    let root: any; let endIds: number[];
    try {
      const res = await endAndAggregate();
      root = res.root; endIds = res.endIds as any;
    } catch (e: any) {
      return safeEditReply({ content: `Failed to close: ${String(e?.message || e)}`, components: [] });
    }
    // Participants and review defaults (use per-type thresholds)
    const participants = await prisma.eventSessionParticipant.findMany({ where: { eventSessionId: root.id } });
    const endedGroup = await prisma.eventSession.findMany({ where: { id: { in: endIds } }, orderBy: { startedAt: "asc" } });
    const nowMs = Date.now();
    const startedAtMs = endedGroup.length ? Math.min(...endedGroup.map((s: any) => new Date(s.startedAt).getTime())) : (root.startedAt ? new Date(root.startedAt).getTime() : nowMs);
    const endedAtMs = endedGroup.length ? Math.max(...endedGroup.map((s: any) => new Date(s.endedAt ?? new Date()).getTime())) : (root.endedAt ? new Date(root.endedAt).getTime() : nowMs);
    const sessionSeconds = Math.max(1, Math.floor((endedAtMs - startedAtMs) / 1000));
    const key = getReviewStateKey(root.id, interaction.user.id);
    const defaults = new Map<string, "merit" | "none">();
    // Read per-type thresholds (fallback to config if missing)
    const mtBrief = root.meritTypeId ? await prisma.meritType.findUnique({ where: { id: root.meritTypeId }, select: { minPercentPresent: true, minPercentNotMuted: true } }) : null;
    const speakingOverride = getMeritMinSpeakingPctOverride();
    const presentOverride = getMeritMinPresentPctOverride();
    const thresholdPct = speakingOverride ?? ((typeof mtBrief?.minPercentNotMuted === 'number') ? mtBrief!.minPercentNotMuted : getMeritMinSpeakingPct());
    const presentMinPct = presentOverride ?? ((typeof mtBrief?.minPercentPresent === 'number') ? mtBrief!.minPercentPresent : getMeritMinPresentPct());
    for (const p of participants) {
      const presentSecs = Math.max(0, p.totalSecondsPresent || 0);
      const speakSecs = Math.max(0, p.totalSecondsSpeaking || 0);
      const pct = sessionSeconds > 0 ? (speakSecs / sessionSeconds) * 100 : 0;
      const presentPctOfSession = sessionSeconds > 0 ? (presentSecs / sessionSeconds) * 100 : 0;
      const meets = (pct >= thresholdPct) && (presentPctOfSession >= presentMinPct);
      const meritDefault = meets ? "merit" : "none";
      defaults.set(p.userId, meritDefault);
    }
    upsertReviewState(key, defaults);
    // Sort participants to match UI ordering (by configured percent desc, then present time)
    const participantsSorted = [...participants].sort((a, b) => {
      const aP = Math.max(0, a.totalSecondsPresent || 0);
      const aS = Math.max(0, a.totalSecondsSpeaking || 0);
      const bP = Math.max(0, b.totalSecondsPresent || 0);
      const bS = Math.max(0, b.totalSecondsSpeaking || 0);
      const aPct = sessionSeconds > 0 ? aS / sessionSeconds : 0;
      const bPct = sessionSeconds > 0 ? bS / sessionSeconds : 0;
      if (bPct !== aPct) return bPct - aPct;
      return bP - aP;
    });
    const mt = root.meritTypeId ? await prisma.meritType.findUnique({
      where: { id: root.meritTypeId },
      select: {
        id: true,
        name: true,
        description: true,
        value: true,
        createdAt: true,
        updatedAt: true,
        minPercentPresent: true,
        minPercentNotMuted: true,
      },
    }) : null;
    const minPercentPresent = mt?.minPercentPresent ?? 0;
    const minPercentNotMuted = mt?.minPercentNotMuted ?? 0;
    const nameMap = new Map<string, string>();
    if (participantsSorted.length) {
      const rows = await prisma.user.findMany({ where: { id: { in: participantsSorted.map(p => p.userId) } }, select: { id: true, nickname: true, name: true, username: true } });
      for (const r of rows) nameMap.set(r.id, r.nickname || r.name || r.username || r.id);
    }
    const page = 0;
    const message = buildEventReviewMessage({
      sessionId: root.id,
      channelId: root.channelId,
      sessionSeconds,
      participants: participantsSorted,
      page,
      reviewerId: interaction.user.id,
      nameMap,
      awardDescription: root.awardDescription ?? undefined,
      meritTypeName: mt?.name,
      meritValue: (mt as any)?.value ?? undefined,
      minPercentPresent,
      minPercentNotMuted,
    });
    // Post an initial follow-up in thread indicating review started
    try {
      const info = getNotifyInfo(root.id) || getNotifyInfo(sessionId);
      if (info?.threadId) {
        const guild = await interaction.client.guilds.fetch(root.guildId);
        const thread = await guild.channels.fetch(info.threadId).catch(() => null as any);
        if (thread && (thread as any).isTextBased?.()) {
          await (thread as any).send(`Session ${root.id} has been closed. A review has been opened to determine merits.`);
        }
      }
    } catch { /* ignore follow-up errors */ }
    return safeEditReply(message as any);
  }
}
