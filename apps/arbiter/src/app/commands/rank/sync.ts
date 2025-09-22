import type { ChatInputCommandContext, CommandData } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { syncNicknameAuto, syncNicknameForDivision } from "../../services/rankSync.ts";

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
    ],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const sub = interaction.options.getSubcommand();
    if (sub !== "sync") return;
    if (!interaction.inGuild()) {
        return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    }
    const userId = interaction.options.getString("user", true);
    const divisionCode = interaction.options.getString("division", false)?.toUpperCase();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        let res: any;
        if (divisionCode) {
            res = await syncNicknameForDivision({ guild: interaction.guild!, userID: userId!, divisionCode });
            if (res?.reason === "division_not_found") {
                return interaction.editReply(`Division ${divisionCode} not found.`);
            }
            if (res?.reason === "division_hidden") {
                return interaction.editReply(`Division ${divisionCode} does not show rank. Nothing to apply.`);
            }
            if (res?.reason === "member_not_found") {
                return interaction.editReply(`User is not in this guild.`);
            }
        } else {
            res = await syncNicknameAuto({ guild: interaction.guild!, userID: userId! });
            if (res?.reason === "no_division") {
                return interaction.editReply(`No eligible division found for this user (try specifying LGN or a combat division).`);
            }
        }
        if (!res) return interaction.editReply(`No change.`);
        if (res.reason === "missing_permissions_bypassed") {
            const detail = res?.permDetail === 'role_hierarchy'
                ? 'blocked by role hierarchy'
                : (res?.permDetail === 'missing_manage_nicknames' ? 'bot lacks Manage Nicknames' : 'Missing Permissions');
            return interaction.editReply(`Approved (dev bypass): would set <@${userId}> to “${res.after}”, but ${detail} in this environment.`);
        }
        if (res.reason === "error") {
            if (res?.errorCode === 50013 || String(res?.error ?? '').includes('Missing Permissions')) {
                const detail = res?.permDetail === 'role_hierarchy'
                    ? 'blocked by role hierarchy'
                    : (res?.permDetail === 'missing_manage_nicknames' ? 'bot lacks Manage Nicknames' : 'Missing Permissions');
                return interaction.editReply(`Failed to set nickname for <@${userId}>: 50013 ${detail}.`);
            }
            return interaction.editReply(`Failed to set nickname for <@${userId}>: ${res.errorCode ?? ''} ${res.error ?? ''}`.trim());
        }
        if ("before" in res && "after" in res) {
            if (res.applied) return interaction.editReply(`Synced <@${userId}>: ${res.before} → ${res.after}`);
            return interaction.editReply(`No change needed for <@${userId}>.`);
        }
        return interaction.editReply(`Done.`);
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
