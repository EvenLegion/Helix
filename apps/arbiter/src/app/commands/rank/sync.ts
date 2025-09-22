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
                    description: "Target user",
                    type: 6, // USER
                    required: true,
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
    if (interaction.options.getSubcommand() !== "sync") return;
    if (!interaction.inGuild()) {
        return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    }
    const user = interaction.options.getUser("user", true);
    const divisionCode = interaction.options.getString("division", false)?.toUpperCase();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        let res: any;
        if (divisionCode) {
            res = await syncNicknameForDivision({ guild: interaction.guild!, userID: user.id, divisionCode });
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
            res = await syncNicknameAuto({ guild: interaction.guild!, userID: user.id });
            if (res?.reason === "no_division") {
                return interaction.editReply(`No eligible division found for this user (try specifying LGN or a combat division).`);
            }
        }
        if (!res) return interaction.editReply(`No change.`);
        if (res.reason === "missing_permissions_bypassed") {
            const detail = res?.permDetail === 'role_hierarchy'
                ? 'blocked by role hierarchy'
                : (res?.permDetail === 'missing_manage_nicknames' ? 'bot lacks Manage Nicknames' : 'Missing Permissions');
            return interaction.editReply(`Approved (dev bypass): would set ${user.tag} to “${res.after}”, but ${detail} in this environment.`);
        }
        if (res.reason === "error") {
            if (res?.errorCode === 50013 || String(res?.error ?? '').includes('Missing Permissions')) {
                const detail = res?.permDetail === 'role_hierarchy'
                    ? 'blocked by role hierarchy'
                    : (res?.permDetail === 'missing_manage_nicknames' ? 'bot lacks Manage Nicknames' : 'Missing Permissions');
                return interaction.editReply(`Failed to set nickname for ${user.tag}: 50013 ${detail}.`);
            }
            return interaction.editReply(`Failed to set nickname for ${user.tag}: ${res.errorCode ?? ''} ${res.error ?? ''}`.trim());
        }
        if ("before" in res && "after" in res) {
            if (res.applied) return interaction.editReply(`Synced ${user.tag}: ${res.before} → ${res.after}`);
            return interaction.editReply(`No change needed for ${user.tag}.`);
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
    if (!focused || focused.name !== "division") return;
    const q = String(focused.value ?? "").trim().toLowerCase();
    const divisions = await prisma.division.findMany({ orderBy: { code: "asc" }, take: 50 });
    const items = divisions
        .map(d => ({ code: d.code, name: d.name, show: d.showRank }))
        .filter(d => !q || d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
        .slice(0, 25)
        .map(d => ({ name: `${d.code} — ${d.name}${d.show ? '' : ' (hidden)'}`.slice(0, 100), value: d.code }));
    await interaction.respond(items);
}
