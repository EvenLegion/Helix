import { ButtonInteraction, Client, MessageFlags, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction as loggerForInteraction } from "@workspace/logger";
import { stopSessionTracker } from "../../services/sessionTracker";
import { getNotifyInfo, clearNotifyInfo } from "../../services/notifyStore";
import { startChannelCleanupWatcher } from "../../services/channelCleanup";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { upsertReviewState, getReviewStateKey } from "../../services/reviewStore.ts";

// Mirror the Centurion requirement used by /event middleware (with admin bypass)
const CENTURION_ROLE_ID = "1352378365809786970";

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

    // Permission: allow administrators, Centurions, or the event creator (root.startedBy)
    let isAdmin = false, isCenturion = false, isCreator = false;
    try {
      const root = active.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
      const guild = await interaction.client.guilds.fetch(root!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      isCreator = root?.startedBy === interaction.user.id;
    } catch { /* leave flags false if fetch fails */ }
    if (!(isAdmin || isCenturion || isCreator)) {
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
    return interaction.update({ content: "Close cancelled. Event remains active.", components: [] });
  }

  if (action === "nomerits") {
    // Permission: admins, Centurions, or event creator
    let isAdmin = false, isCenturion = false, isCreator = false;
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    const root = active?.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
    try {
      const guild = await interaction.client.guilds.fetch(root!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      isCreator = root?.startedBy === interaction.user.id;
    } catch { /* leave false */ }
    if (!(isAdmin || isCenturion || isCreator)) {
      return interaction.reply({ content: "You don't have permission to close events.", flags: MessageFlags.Ephemeral });
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
      return interaction.update({ content: `Failed to close: ${String(e?.message || e)}`, components: [] });
    }
    return interaction.update({ content: `Event closed. No merits awarded.`, components: [] });
  }

  if (action === "confirm") {
    // Permission: admins, Centurions, or event creator
    let isAdmin = false, isCenturion = false, isCreator = false;
    const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    const rootForPerm = active?.rootSessionId ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } }) : active;
    try {
      const guild = await interaction.client.guilds.fetch(rootForPerm!.guildId);
      const member = await guild.members.fetch(interaction.user.id);
      isAdmin = member.permissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
      isCenturion = Boolean(member.roles?.cache?.has?.(CENTURION_ROLE_ID));
      isCreator = rootForPerm?.startedBy === interaction.user.id;
    } catch { /* leave false */ }
    if (!(isAdmin || isCenturion || isCreator)) {
      return interaction.reply({ content: "You don't have permission to close events.", flags: MessageFlags.Ephemeral });
    }
    // End and then build review UI
    let root: any; let endIds: number[];
    try {
      const res = await endAndAggregate();
      root = res.root; endIds = res.endIds as any;
    } catch (e: any) {
      return interaction.update({ content: `Failed to close: ${String(e?.message || e)}`, components: [] });
    }
    // Participants and review defaults
    const participants = await prisma.eventSessionParticipant.findMany({ where: { eventSessionId: root.id }, orderBy: { totalSecondsPresent: "desc" } });
    const endedGroup = await prisma.eventSession.findMany({ where: { id: { in: endIds } }, orderBy: { startedAt: "asc" } });
    const nowMs = Date.now();
    const startedAtMs = endedGroup.length ? Math.min(...endedGroup.map((s: any) => new Date(s.startedAt).getTime())) : (root.startedAt ? new Date(root.startedAt).getTime() : nowMs);
    const endedAtMs = endedGroup.length ? Math.max(...endedGroup.map((s: any) => new Date(s.endedAt ?? new Date()).getTime())) : (root.endedAt ? new Date(root.endedAt).getTime() : nowMs);
    const sessionSeconds = Math.max(1, Math.floor((endedAtMs - startedAtMs) / 1000));
    const key = getReviewStateKey(root.id, interaction.user.id);
    const defaults = new Map<string, "merit" | "none">();
    for (const p of participants) {
      const meritDefault = (p.totalSecondsPresent / sessionSeconds) >= 0.2 ? "merit" : "none";
      defaults.set(p.userId, meritDefault);
    }
    upsertReviewState(key, defaults);
    const mt = root.meritTypeId ? await prisma.meritType.findUnique({ where: { id: root.meritTypeId } }) : null;
    const nameMap = new Map<string, string>();
    if (participants.length) {
      const rows = await prisma.user.findMany({ where: { id: { in: participants.map(p => p.userId) } }, select: { id: true, nickname: true, name: true, username: true } });
      for (const r of rows) nameMap.set(r.id, r.nickname || r.name || r.username || r.id);
    }
    const page = 0;
    const message = buildEventReviewMessage({
      sessionId: root.id,
      channelId: root.channelId,
      sessionSeconds,
      participants,
      page,
      reviewerId: interaction.user.id,
      nameMap,
      awardDescription: root.awardDescription ?? undefined,
      meritTypeName: mt?.name,
      meritValue: (mt as any)?.value ?? undefined,
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
    return interaction.update(message as any);
  }
}
