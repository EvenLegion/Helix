import { MiddlewareContext, stopMiddlewares } from "commandkit";
import { MessageFlags, PermissionsBitField } from "discord.js";
import { forInteraction } from "@workspace/logger";
import { CONFIG, isDev } from "../../config";

// Merit commands are intended to be available to all members by default.
// This middleware exists to mirror the structure of other command groups
// (event, rank, development) and gives us a single place to add rules later
// (e.g., gating future subcommands like "grant" to Staff roles).
export async function beforeExecute(ctx: MiddlewareContext) {
    const { interaction } = ctx;

    // Allow in development or when explicitly bypassing
    if (isDev() || CONFIG.DEV_BYPASS) return;

    if (!interaction.inGuild()) return; // ignore DMs

    // Allow administrators universally
    if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return;
    }

    // Require Legionnaire role for /get-merits
    const LEGIONNAIRE = CONFIG.LEGIONNAIRE_ROLE_ID;
    let member = interaction.guild?.members.cache.get(interaction.user.id) as any;
    if (!member && interaction.guild) {
        try { member = await interaction.guild.members.fetch(interaction.user.id); } catch { member = null; }
    }
    const allowed = (member as any)?.roles?.cache?.has?.(LEGIONNAIRE);
    if (allowed) return;

    if (interaction.isRepliable()) {
        await interaction.reply({
            content: "This command is only available to Legionnaires.",
            flags: MessageFlags.Ephemeral,
        });
    }
    const log = forInteraction(interaction).child({ mod: "middleware", group: "merit" });
    log.warn({ reason: "insufficient_role" }, "Blocked /get-merits due to missing Legionnaire role");
    stopMiddlewares();
    return;
}
