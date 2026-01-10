import { MiddlewareContext, stopMiddlewares } from "commandkit";
import { MessageFlags, PermissionsBitField } from "discord.js";
import { forInteraction } from "@workspace/logger";
import { CONFIG, isDev } from "../../config";

// Only Server Staff (or admins) can use /post-division-message (unless in dev/bypass)
export async function beforeExecute(ctx: MiddlewareContext) {
	const { interaction } = ctx;

	// Allow in development or when explicitly bypassing
	if (isDev() || CONFIG.DEV_BYPASS) return;

	if (!interaction.inGuild()) return; // ignore DMs

	// Allow administrators universally
	if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return;

	// Require Staff role
	const STAFF = CONFIG.STAFF_ROLE_ID;
	let member = interaction.guild?.members.cache.get(interaction.user.id) as any;
	if (!member && interaction.guild) {
		try { member = await interaction.guild.members.fetch(interaction.user.id); } catch { member = null; }
	}
	const allowed = (member as any)?.roles?.cache?.has?.(STAFF);
	if (allowed) return;

	if (interaction.isRepliable()) {
		await interaction.reply({
			content: "This command is only available to Server Staff.",
			flags: MessageFlags.Ephemeral,
		});
	}

	const log = forInteraction(interaction).child({ mod: "middleware", group: "post-division-message" });
	log.warn({ reason: "insufficient_role" }, "Blocked /post-division-message due to missing Staff role");
	stopMiddlewares();
}
