import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { EventSessionParticipant } from "@workspace/db";
import { getMeritMinSpeakingPct, getMeritMinPresentPct, getMeritScoreMode } from "../services/eventConfig";
import { getSelection } from "../services/reviewStore";

type BuildArgs = {
  sessionId: number;
  channelId: string;
  sessionSeconds: number;
  participants: Array<EventSessionParticipant>;
  reviewerId: string;
  page: number;
  nameMap?: Map<string, string>;
  awardDescription?: string;
  meritTypeName?: string;
  meritValue?: number;
};

// With 3 buttons per user row and 1 nav row, we can show up to 4 users per message (Discord allows max 5 rows)
const PAGE_SIZE = 4;

export function buildEventReviewMessage(args: BuildArgs) {
  const { sessionId, channelId, sessionSeconds, participants, reviewerId, nameMap, awardDescription, meritTypeName, meritValue } = args;
  const page = Math.max(0, args.page || 0);
  const start = page * PAGE_SIZE;
  const mode = getMeritScoreMode();
  // Sort participants by participation percent based on mode, descending
  const sorted = [...participants].sort((a, b) => {
    const aP = Math.max(0, a.totalSecondsPresent || 0);
    const aS = Math.max(0, a.totalSecondsSpeaking || 0);
    const bP = Math.max(0, b.totalSecondsPresent || 0);
    const bS = Math.max(0, b.totalSecondsSpeaking || 0);
    const aPct = mode === 'speaking_over_session' ? (sessionSeconds > 0 ? aS / sessionSeconds : 0) : (aP > 0 ? aS / aP : 0);
    const bPct = mode === 'speaking_over_session' ? (sessionSeconds > 0 ? bS / sessionSeconds : 0) : (bP > 0 ? bS / bP : 0);
    if (bPct !== aPct) return bPct - aPct;
    // tie-breaker: more present time first
    return bP - aP;
  });
  const slice = sorted.slice(start, start + PAGE_SIZE);

  const descLines: string[] = [];
  if (awardDescription && awardDescription.trim().length) {
    descLines.push(`Event: ${awardDescription.trim().slice(0, 255)}`);
  }
  if (typeof meritTypeName !== 'undefined') {
    const valueText = typeof meritValue === 'number' ? ` (+${meritValue})` : '';
    descLines.push(`Merit: ${meritTypeName}${valueText}`);
  }
  descLines.push(`Session length: ${formatDuration(sessionSeconds)}`);
  const thresholdPct = getMeritMinSpeakingPct();
  const presentMinPct = getMeritMinPresentPct();
  const scoreLabel = mode === 'speaking_over_session' ? '% = speaking/session' : '% = speaking/present';
  descLines.push(`Per user: P = time present • S = time speaking • ${scoreLabel}`);
  if (mode === 'dual_thresholds' && presentMinPct > 0) {
    descLines.push(`Default Merit if: (speaking% ≥ ${thresholdPct}%) AND (present ≥ ${presentMinPct}% of session).`);
  } else if (mode === 'speaking_over_session') {
    descLines.push(`Default Merit if speaking% ≥ ${thresholdPct}% of the entire session.`);
  } else {
    descLines.push(`Default Merit if speaking% ≥ ${thresholdPct}% while present.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`Review session ${sessionId} in <#${channelId}>`)
    .setDescription(descLines.join('\n'))
    .setColor(0x4b9cd3);

  const rows: Array<ActionRowBuilder<any>> = [];

  for (const p of slice) {
    const uid = p.userId;
    const display = nameMap?.get(uid) ?? uid;
    const presentSecs = Math.max(0, p.totalSecondsPresent || 0);
    const speakSecs = Math.max(0, p.totalSecondsSpeaking || 0);
    const pctBase = mode === 'speaking_over_session' ? (sessionSeconds > 0 ? (speakSecs / sessionSeconds) : 0) : (presentSecs > 0 ? (speakSecs / presentSecs) : 0);
    const pct = Math.round(pctBase * 100);
    const timeText = `P ${formatDuration(presentSecs)} • S ${formatDuration(speakSecs)} (${pct}%)`;
    const safeName = display.length > 40 ? display.slice(0, 37) + '…' : display;
    const nameBtn = new ButtonBuilder()
      .setCustomId(`eventrev:name:${sessionId}:${reviewerId}:${uid}:${page}`)
      .setLabel(safeName)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const timeBtn = new ButtonBuilder()
      .setCustomId(`eventrev:time:${sessionId}:${reviewerId}:${uid}:${page}`)
      .setLabel(timeText)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const current = getSelection(`${sessionId}:${reviewerId}`, uid);
    const merit = new ButtonBuilder()
      .setCustomId(`eventrev:rb:${sessionId}:${reviewerId}:${uid}:merit:${page}`)
      .setLabel("Merit")
      .setStyle(current === 'merit' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const none = new ButtonBuilder()
      .setCustomId(`eventrev:rb:${sessionId}:${reviewerId}:${uid}:none:${page}`)
      .setLabel("None")
      .setStyle(current === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary);

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(merit, none, nameBtn, timeBtn));
  }

  // Navigation and confirm/cancel
  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`eventrev:prev:${sessionId}:${reviewerId}:${page}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`eventrev:next:${sessionId}:${reviewerId}:${page}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(start + PAGE_SIZE >= participants.length),
    new ButtonBuilder()
      .setCustomId(`eventrev:confirm:${sessionId}:${reviewerId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`eventrev:nomerits:${sessionId}:${reviewerId}`)
      .setLabel("Assign no Merits")
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(nav);

  return { embeds: [embed], components: rows };
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s]
    .map((v, i) => (i === 0 ? v : String(v).padStart(2, '0')))
    .join(':');
}
