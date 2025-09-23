import { Client, Interaction, MessageFlags } from "discord.js";
import { getState, updatePage, clearState } from "../../services/rankReviewStore.ts";
import { buildRankReviewMessage } from "../../ui/rankReview.ts";
import { syncNicknameAuto, syncNicknameForDivision } from "../../services/rankSync.ts";

export default async function (interaction: Interaction, client: Client) {
    if (!interaction.isButton()) return;
    const id = interaction.customId;
    if (!id || !id.startsWith('ranksync:')) return;

    const parts = id.split(':');
    // formats:
    // ranksync:prev|next:<scopeKey>:<reviewerId>:<page>
    // ranksync:accept|cancel:<scopeKey>:<reviewerId>
    const action = parts[1];
    let scopeKey = "";
    let reviewerId = "";
    let page = 0;
    if (action === 'prev' || action === 'next') {
        page = Number(parts[parts.length - 1] || 0) || 0;
        reviewerId = parts[parts.length - 2] || '';
        scopeKey = parts.slice(2, Math.max(2, parts.length - 2)).join(':');
    } else {
        reviewerId = parts[parts.length - 1] || '';
        scopeKey = parts.slice(2, Math.max(2, parts.length - 1)).join(':');
    }

    if (!scopeKey) {
        return interaction.update({ content: 'Invalid or expired review id.', components: [], embeds: [] });
    }

    if (interaction.user.id !== reviewerId) {
        return interaction.reply({ content: 'This review can only be controlled by the moderator who started it.', flags: MessageFlags.Ephemeral });
    }

    const state = getState(scopeKey);
    if (!state) {
        return interaction.update({ content: 'Review expired or not found.', components: [], embeds: [] });
    }

    if (action === 'prev' || action === 'next') {
        const newPage = action === 'prev' ? Math.max(0, page - 1) : page + 1;
        updatePage(scopeKey, newPage);
        const msg = buildRankReviewMessage(state, scopeKey, reviewerId);
        return interaction.update(msg as any);
    }

    if (action === 'cancel') {
        clearState(scopeKey);
        return interaction.update({ content: 'Rank sync review cancelled.', components: [], embeds: [] });
    }

    if (action === 'accept') {
        // Apply all changes that willChange=true
        const guild = interaction.guild;
        let applied = 0, noChange = 0, errors = 0, bypass = 0, hidden = 0, notInGuild = 0;
        if (!guild) {
            clearState(scopeKey);
            return interaction.update({ content: 'No guild context available.', components: [], embeds: [] });
        }
        await interaction.deferUpdate();
        for (const entry of state.entries) {
            try {
                if (!entry.willChange) { noChange++; continue; }
                const res = state.meta.divisionCode
                    ? await syncNicknameForDivision({ guild, userID: entry.userId, divisionCode: state.meta.divisionCode })
                    : await syncNicknameAuto({ guild, userID: entry.userId });
                if (res?.reason === 'division_hidden') hidden++;
                else if (res?.reason === 'member_not_found') notInGuild++;
                else if (res?.reason === 'missing_permissions_bypassed') bypass++;
                else if (res?.reason === 'error') errors++;
                else if (res && 'applied' in res) {
                    if (res.applied) applied++; else noChange++;
                } else noChange++;
            } catch { errors++; }
        }
        clearState(scopeKey);
        return interaction.editReply({
            content: `Applied: ${applied}, no-change: ${noChange}, bypass: ${bypass}, hidden: ${hidden}, errors: ${errors}${notInGuild ? `, not-in-guild: ${notInGuild}` : ''}`,
            components: [],
            embeds: [],
        });
    }
}
