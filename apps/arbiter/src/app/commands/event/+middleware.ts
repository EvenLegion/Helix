import { MiddlewareContext, stopMiddlewares } from "commandkit";
import { MessageFlags, PermissionsBitField } from "discord.js";
import { forInteraction } from "@workspace/logger";

// Centurion role required for /event commands (unless dev or admin)
const CENTURION_ROLE_ID = "1352378365809786970";

export async function beforeExecute(ctx: MiddlewareContext) {
    const { interaction } = ctx;

    // Dev bypass
    const isDevEnv =
        process.env.ENVIRONMENT === "development" ||
        process.env.NODE_ENV === "development";
    const bypass = process.env.DEV_BYPASS_MIDDLEWARE === "true";
    if (isDevEnv || bypass) return;

    if (!interaction.inGuild()) return;

    // Allow administrators
    if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return;
    }

    // Require Centurion role
    let member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member && interaction.guild) {
        try { member = await interaction.guild.members.fetch(interaction.user.id); } catch { member = null as any; }
    }
    const allowed = (member as any)?.roles?.cache?.has?.(CENTURION_ROLE_ID);
    if (allowed) return;

    if (interaction.isRepliable()) {
        await interaction.reply({
            content: "This command is only available to Centurions.",
            flags: MessageFlags.Ephemeral,
        });
    }
    const log = forInteraction(interaction).child({ mod: 'middleware', group: 'event' });
    log.warn({ reason: 'insufficient_role' }, 'Blocked /event due to missing Centurion role');
    stopMiddlewares();
}
