import { MiddlewareContext, stopMiddlewares } from "commandkit";
import { MessageFlags, PermissionsBitField } from "discord.js";
import { forInteraction } from "@workspace/logger";

export async function beforeExecute(ctx: MiddlewareContext) {
    const { interaction } = ctx;

    // Bypass in development or when explicitly enabled
    const isDevEnv =
        process.env.ENVIRONMENT === "development" ||
        process.env.NODE_ENV === "development";
    const bypass = process.env.DEV_BYPASS_MIDDLEWARE === "true";

    if (isDevEnv || bypass) {
        return; // allow execution during local dev
    }

    // If not in a guild, nothing to check
    if (!interaction.inGuild()) return;

    // Allow users with Administrator permission
    if (
        interaction.memberPermissions?.has(
            PermissionsBitField.Flags.Administrator
        )
    ) {
        return;
    }

    // Otherwise require the Server Staff Role
    const STAFF_ROLE_ID = "1364287451576930326";
    let guildMember = interaction.guild?.members.cache.get(interaction.user.id) as any;
    if (!guildMember && interaction.guild) {
        try {
            guildMember = await interaction.guild.members.fetch(interaction.user.id);
        } catch {
            guildMember = null;
        }
    }

    const hasStaffRole = (guildMember as any)?.roles?.cache?.has?.(STAFF_ROLE_ID);
    if (hasStaffRole) return;

    if (interaction.isRepliable()) {
        await interaction.reply({
            content: "This command is only available to the server admins.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const log = forInteraction(interaction).child({ mod: 'middleware', command: ctx.commandName });
    log.warn('Command will not be executed due to insufficient permissions');
    stopMiddlewares();
}
