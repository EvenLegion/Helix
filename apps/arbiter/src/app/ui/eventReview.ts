import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { EventSessionParticipant } from "@workspace/db";
import { getSelection } from "../services/reviewStore";

type BuildArgs = {
  sessionId: number;
  channelId: string;
  sessionSeconds: number;
  participants: Array<EventSessionParticipant>;
  reviewerId: string;
  page: number;
  nameMap?: Map<string, string>;
};

// With 3 buttons per user row and 1 nav row, we can show up to 4 users per message (Discord allows max 5 rows)
const PAGE_SIZE = 4;

export function buildEventReviewMessage(args: BuildArgs) {
  const { sessionId, channelId, sessionSeconds, participants, reviewerId, nameMap } = args;
  const page = Math.max(0, args.page || 0);
  const start = page * PAGE_SIZE;
  const slice = participants.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(`Review session ${sessionId} in <#${channelId}>`)
    .setDescription(`Session length: ${formatDuration(sessionSeconds)}\nSelect Merit/Demerit/None for each participant. Default Merit if >=20% speaking.`)
    .setColor(0x4b9cd3);

  const rows: Array<ActionRowBuilder<any>> = [];

  for (const p of slice) {
    const uid = (p.userId || '').trim();
    const display = nameMap?.get(uid) ?? uid;
    const timeText = formatDuration(p.totalSecondsPresent);
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
    const demerit = new ButtonBuilder()
      .setCustomId(`eventrev:rb:${sessionId}:${reviewerId}:${uid}:demerit:${page}`)
      .setLabel("Demerit")
      .setStyle(current === 'demerit' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    const none = new ButtonBuilder()
      .setCustomId(`eventrev:rb:${sessionId}:${reviewerId}:${uid}:none:${page}`)
      .setLabel("None")
      .setStyle(current === 'none' ? ButtonStyle.Primary : ButtonStyle.Secondary);

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(merit, demerit, none, nameBtn, timeBtn));
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
      .setCustomId(`eventrev:cancel:${sessionId}:${reviewerId}`)
      .setLabel("Cancel")
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
