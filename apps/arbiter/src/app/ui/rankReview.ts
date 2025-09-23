import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { RankReviewState } from "../services/rankReviewStore";

const PAGE_SIZE = 10; // show 10 users per page for review

export function buildRankReviewMessage(state: RankReviewState, scopeKey: string, reviewerId: string) {
    const { entries, meta } = state;
    const page = Math.max(0, meta.page || 0);
    const start = page * PAGE_SIZE;
    const slice = entries.slice(start, start + PAGE_SIZE);

    const embed = new EmbedBuilder()
        .setTitle(meta.mode === 'single' ? 'Review rank sync' : 'Review rank sync — bulk')
        .setDescription(
            meta.mode === 'single'
                ? 'Review the nickname update for the selected user. Accept to apply or Cancel to discard.'
                : 'Review all nickname updates. Use Prev/Next to page. Accept to apply all on this list or Cancel to discard.'
        )
        .setColor(0x4b9cd3)
        .setFooter({ text: `Page ${page + 1} • ${entries.length} user(s)` });

    const lines: string[] = [];
    for (const e of slice) {
        const label = e.displayName.length > 36 ? e.displayName.slice(0, 33) + '…' : e.displayName;
        const before = e.before.length > 32 ? e.before.slice(0, 29) + '…' : e.before;
        const after = e.after.length > 32 ? e.after.slice(0, 29) + '…' : e.after;
        if (e.willChange) lines.push(`• ${label}: ${before} → ${after}`);
        else lines.push(`• ${label}: no change`);
    }
    if (!lines.length) lines.push('No changes.');
    embed.addFields({ name: 'Preview', value: lines.join('\n').slice(0, 4000) });

    const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
    const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ranksync:prev:${scopeKey}:${reviewerId}:${page}`)
            .setLabel('Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`ranksync:next:${scopeKey}:${reviewerId}:${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(start + PAGE_SIZE >= entries.length),
        new ButtonBuilder()
            .setCustomId(`ranksync:accept:${scopeKey}:${reviewerId}`)
            .setLabel('Apply')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`ranksync:cancel:${scopeKey}:${reviewerId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger),
    );
    rows.push(nav);

    return { embeds: [embed], components: rows };
}
