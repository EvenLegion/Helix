import { ButtonInteraction, Client, MessageFlags, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction as loggerForInteraction } from "@workspace/logger";
import { stopSessionTracker } from "../../services/sessionTracker";
import { startChannelCleanupWatcher } from "../../services/channelCleanup";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { upsertReviewState, getReviewStateKey } from "../../services/reviewStore.ts";

// Mirror the Centurion requirement used by /event middleware (with admin bypass)
const CENTURION_ROLE_ID = "1352378365809786970";

export default async function (interaction: ButtonInteraction, client: Client) {
  if (!interaction.isButton()) return;
  const id = interaction.customId || "";
  if (!id.startsWith("event:close:")) return;

  const log = loggerForInteraction(interaction).child({ mod: "event", action: "close-button" });

  // Permission: allow administrators; else require Centurion role (same as /event middleware)
  if (interaction.inGuild()) {
    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
    let isCenturion = false;
    if (!isAdmin) {
      try {
        const member = await interaction.guild!.members.fetch(interaction.user.id);
        isCenturion = Boolean((member as any)?.roles?.cache?.has?.(CENTURION_ROLE_ID));
      } catch {
        isCenturion = false;
      }
    }
    if (!isAdmin && !isCenturion) {
      return interaction.reply({ content: "You don't have permission to close events.", flags: MessageFlags.Ephemeral });
    }
  }

  const parts = id.split(":");
  const sessionId = Number(parts[2]);
  if (!Number.isFinite(sessionId)) {
    return interaction.reply({ content: "Invalid session id.", flags: MessageFlags.Ephemeral });
  }

  // Load the active session for this id and determine group (root + children)
  const active = await prisma.eventSession.findUnique({ where: { id: sessionId } });
  if (!active) {
    return interaction.reply({ content: `Session ${sessionId} not found.`, flags: MessageFlags.Ephemeral });
  }
  if (active.endedAt) {
    return interaction.reply({ content: `Session ${sessionId} is already ended.`, flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const root = active.rootSessionId
    ? await prisma.eventSession.findUnique({ where: { id: active.rootSessionId } })
    : active;
  if (!root) {
    return interaction.editReply({ content: "Failed to resolve root session." });
  }
  const groupSessions = await prisma.eventSession.findMany({
    where: { OR: [{ id: root.id }, { rootSessionId: root.id }], endedAt: null },
    orderBy: { startedAt: "asc" },
  });

  const now = new Date();
  const endIds = groupSessions.map(s => s.id);
  if (endIds.length) {
    await prisma.eventSession.updateMany({ where: { id: { in: endIds } }, data: { endedAt: now, status: "ENDED" } });
    for (const id of endIds) stopSessionTracker(id);
  }
  log.debug({ rootId: root.id, count: endIds.length }, "Closed sessions via button");

  // Attempt to disable the button on the original notification message to avoid duplicate clicks
  try {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("event:closed")
        .setLabel("Closed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    // Only edit if this interaction came from a message we can edit
    if (interaction.message && (interaction.message as any).editable !== false) {
      await (interaction.message as any).edit({ components: [row] });
    }
  } catch { }

  // Start cleanup for bot-created channels
  const endedWithMeta = await prisma.eventSession.findMany({ where: { id: { in: endIds } } });
  for (const s of endedWithMeta) {
    if (s.createdByBot) {
      try { startChannelCleanupWatcher(client, s.guildId, s.channelId); } catch { }
    }
  }

  // Aggregate participants into root
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
      create: {
        eventSessionId: root.id,
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

  // Compute session duration and open the review UI in the ephemeral reply
  const participants = await prisma.eventSessionParticipant.findMany({
    where: { eventSessionId: root.id },
    orderBy: { totalSecondsPresent: "desc" },
  });
  const endedGroup = await prisma.eventSession.findMany({ where: { id: { in: endIds } }, orderBy: { startedAt: "asc" } });
  const startedAtMs = endedGroup.length ? Math.min(...endedGroup.map(s => new Date(s.startedAt).getTime())) : (root.startedAt ? new Date(root.startedAt).getTime() : Date.now());
  const endedAtMs = endedGroup.length ? Math.max(...endedGroup.map(s => new Date(s.endedAt ?? now).getTime())) : (root.endedAt ? new Date(root.endedAt).getTime() : Date.now());
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
    const rows = await prisma.user.findMany({
      where: { id: { in: participants.map(p => p.userId) } },
      select: { id: true, nickname: true, name: true, username: true },
    });
    for (const r of rows) {
      const disp = r.nickname || r.name || r.username || r.id;
      nameMap.set(r.id, disp);
    }
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
  await interaction.editReply(message as any);
}
