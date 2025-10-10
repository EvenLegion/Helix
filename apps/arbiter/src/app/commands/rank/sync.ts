import type { ChatInputCommandContext, CommandData } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { previewNicknameAuto, previewNicknameForDivision, syncNicknameAuto, syncNicknameForDivision } from "../../services/rankSync.ts";
import { setState, makeKey } from "../../services/rankReviewStore.ts";
import { buildRankReviewMessage } from "../../ui/rankReview.ts";
import { forInteraction } from "@workspace/logger";

export const command: CommandData = {
    name: "rank",
    description: "Rank maintenance",
    options: [
        {
            name: "sync",
            description: "Recompute and apply rank decoration for a user",
            type: 1, // subcommand
            options: [
                {
                    name: "user",
                    description: "Target user (search by name)",
                    type: 3, // STRING (autocomplete)
                    required: true,
                    autocomplete: true,
                },
                {
                    name: "division",
                    description: "Division code to sync in (e.g., HLO, VNG, LGN). If omitted, auto-select.",
                    type: 3, // STRING
                    required: false,
                    autocomplete: true,
                },
            ],
        },
        {
            name: "sync-all",
            description: "Recompute and apply rank decoration for all members in this guild",
            type: 1, // subcommand
            options: [],
        },
    ],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const sub = interaction.options.getSubcommand();
    if (!interaction.inGuild()) {
        return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    }
    const log = forInteraction(interaction).child({ mod: 'rankSync' });
    if (sub === "sync-all") {
        // Build preview list and present review UI (no immediate apply)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            await interaction.guild!.members.fetch();
            const members = Array.from(interaction.guild!.members.cache.values());
            const targets = members.filter(m => !m.user.bot);
            const previews: { userId: string; displayName: string; before: string; after: string; willChange: boolean }[] = [];
            let staffSkipped = 0;
            log.debug({ totalMembers: members.length, nonBotTargets: targets.length }, 'sync-all: building previews');
            for (const m of targets) {
                const pv = await previewNicknameAuto({ guild: interaction.guild!, userID: m.id });
                if (pv.kind === 'ok') {
                    previews.push({ userId: m.id, displayName: m.displayName || m.user.username, before: pv.before, after: pv.after, willChange: pv.willChange });
                } else if (pv.kind === 'skip' && pv.reason === 'is_staff') {
                    staffSkipped++;
                    continue; // do not include staff in the review list
                } else {
                    const before = m.nickname || m.displayName || m.user.username;
                    previews.push({ userId: m.id, displayName: m.displayName || m.user.username, before, after: before, willChange: false });
                }
            }
            log.debug({ previewCount: previews.length, staffSkipped }, 'sync-all: previews ready');
            const scope = makeKey(`bulk_${interaction.id}_${interaction.user.id}`);
            setState(scope, { entries: previews, meta: { mode: 'bulk', total: previews.length, page: 0 } });
            const msg = buildRankReviewMessage({ entries: previews, meta: { mode: 'bulk', total: previews.length, page: 0 } }, scope, interaction.user.id);
            return interaction.editReply(msg as any);
        } catch (e) {
            log.error({ err: e }, 'sync-all preview failed');
            return interaction.editReply(`Error: ${String((e as any)?.message ?? e)}`);
        }
    }
    if (sub !== "sync") return;
    const userId = interaction.options.getString("user", true);
    const divisionCode = interaction.options.getString("division", false)?.toUpperCase();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Build preview for single user and show review UI
        const guild = interaction.guild!;
        const pv = divisionCode
            ? await previewNicknameForDivision({ guild, userID: userId!, divisionCode })
            : await previewNicknameAuto({ guild, userID: userId! });
        if (pv.kind === 'skip' && pv.reason === 'no_division') {
            return interaction.editReply(`No eligible division found for this user (try specifying LGN or a combat division).`);
        }
        if (pv.kind === 'skip' && pv.reason === 'division_hidden') {
            return interaction.editReply(`Selected division does not show rank. Nothing to apply.`);
        }
        if (pv.kind === 'skip' && pv.reason === 'member_not_found') {
            return interaction.editReply(`User is not in this guild.`);
        }
        if (pv.kind === 'skip' && pv.reason === 'is_staff') {
            return interaction.editReply(`User is in staff. Rank sync is disabled for staff members.`);
        }
        if (pv.kind === 'error') {
            return interaction.editReply(`Error: ${pv.message}`);
        }
        const display = (await guild.members.fetch(userId!).then(m => m.displayName).catch(() => userId!));
        if (pv.kind !== 'ok') {
            return interaction.editReply(`No change.`);
        }
        const entries = [{ userId: userId!, displayName: display, before: pv.before, after: pv.after, willChange: pv.willChange }];
        const scope = makeKey(`single_${interaction.id}_${interaction.user.id}`);
        setState(scope, { entries, meta: { mode: 'single', divisionCode: divisionCode ?? undefined, total: entries.length, page: 0 } });
        const msg = buildRankReviewMessage({ entries, meta: { mode: 'single', divisionCode: divisionCode ?? undefined, total: entries.length, page: 0 } }, scope, interaction.user.id);
        return interaction.editReply(msg as any);
    } catch (e) {
        return interaction.editReply(`Error: ${String((e as any)?.message ?? e)}`);
    }
}

// Autocomplete for division option (codes)
export async function autocomplete({ interaction }: any) {
    if (!interaction.isAutocomplete()) return;
    const focused = interaction.options.getFocused(true);
    if (!focused) return;
    const q = String(focused.value ?? "").trim();
    if (focused.name === "division") {
        const ql = q.toLowerCase();
        const divisions = await prisma.division.findMany({ orderBy: { code: "asc" }, take: 50 });
        const items = divisions
            .map(d => ({ code: d.code, name: d.name, show: d.showRank }))
            .filter(d => !ql || d.code.toLowerCase().includes(ql) || d.name.toLowerCase().includes(ql))
            .slice(0, 25)
            .map(d => ({ name: `${d.code} — ${d.name}${d.show ? '' : ' (hidden)'}`.slice(0, 100), value: d.code }));
        return interaction.respond(items);
    }
    if (focused.name === "user") {
        const guild = interaction.guild;
        const choices: Array<{ name: string; value: string }> = [];
        const pushChoice = (label: string | undefined | null, value: string) => {
            // Remove zero-width and control characters, collapse whitespace, then trim
            let name = String(label ?? "");
            name = name.replace(/[\u200B-\u200D\uFEFF]/g, ""); // zero-width
            name = name.replace(/[\u0000-\u001F\u007F]/g, ""); // control chars
            name = name.replace(/\s+/g, " ").trim();
            if (!name) return; // skip entries with no presentable name; never show raw IDs
            if (!choices.find(c => c.value === value)) {
                choices.push({ name: name.slice(0, 100), value });
            }
        };
        // With empty query, suggest recently active (voice) participants from DB, then cached members
        if (q.length === 0) {
            try {
                const recent = await prisma.eventSessionParticipant.findMany({
                    select: { userId: true, updatedAt: true },
                    orderBy: { updatedAt: 'desc' },
                    take: 200,
                });
                const seen = new Set<string>();
                const recentIds: string[] = [];
                for (const r of recent) {
                    if (!seen.has(r.userId)) {
                        seen.add(r.userId);
                        recentIds.push(r.userId);
                        if (recentIds.length >= 50) break;
                    }
                }
                if (recentIds.length) {
                    const dbUsers = await prisma.user.findMany({
                        where: { id: { in: recentIds } },
                        select: { id: true, nickname: true, preferredName: true, username: true },
                    });
                    const byId = new Map(dbUsers.map(u => [u.id, u]));
                    for (const uid of recentIds) {
                        // Prefer live guild nickname/display if available; else DB nickname -> preferredName -> username
                        const m = guild?.members.cache.get(uid);
                        if (m) {
                            pushChoice(m.nickname || m.displayName || m.user?.username, uid);
                        } else {
                            const u = byId.get(uid);
                            pushChoice(u?.nickname || u?.preferredName || u?.username, uid);
                        }
                        if (choices.length >= 25) break;
                    }
                }
            } catch { /* ignore */ }
            if (choices.length < 25 && guild) {
                try {
                    const cached = Array.from(guild.members.cache.values()) as any[];
                    for (const mAny of cached) {
                        const m = mAny as any;
                        if (choices.find(c => c.value === m.id)) continue;
                        pushChoice(m.nickname || m.displayName || m.user?.username, m.id);
                        if (choices.length >= 25) break;
                    }
                } catch { /* ignore */ }
            }
        }
        // Prefer guild member search when a query is present
        if (guild && q.length >= 1 && 'members' in guild && (guild as any).members?.search) {
            try {
                const found = await (guild as any).members.search({ query: q, limit: 25 });
                found.forEach((m: any) => {
                    pushChoice(m.nickname || m.displayName || m.user?.username, m.id);
                });
            } catch {
                // ignore
            }
        }
        // Fallbacks: when no query or search unavailable/empty, use DB user table (best effort)
        if (choices.length < 25) {
            const users = await prisma.user.findMany({
                where: q
                    ? {
                        OR: [
                            { nickname: { contains: q, mode: 'insensitive' } },
                            { preferredName: { contains: q, mode: 'insensitive' } },
                            { username: { contains: q, mode: 'insensitive' } },
                        ],
                    }
                    : undefined,
                orderBy: { updatedAt: 'desc' },
                take: 50,
            });
            for (const u of users) {
                const label = (u.nickname || u.preferredName || u.username);
                if (!label) continue; // skip entries that have no presentable name
                const val = u.id;
                pushChoice(label, val);
                if (choices.length >= 25) break;
            }
        }
        // If still empty, show a prompt stub (must be 1-100 chars)
        if (!choices.length) choices.push({ name: 'Start typing to search users…', value: interaction.user.id });
        return interaction.respond(choices.slice(0, 25));
    }
}
