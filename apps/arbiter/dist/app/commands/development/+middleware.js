import { MessageFlags, PermissionsBitField } from "discord.js";
import { stopMiddlewares } from "commandkit";

//#region src/app/commands/development/+middleware.ts
async function beforeExecute(ctx) {
	const { interaction } = ctx;
	const isDevEnv = process.env.ENVIRONMENT === "development" || false;
	const bypass = process.env.DEV_BYPASS_MIDDLEWARE === "true";
	if (isDevEnv || bypass) return;
	if (!interaction.inGuild()) return;
	if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return;
	const STAFF_ROLE_ID = "1364287451576930326";
	let guildMember = interaction.guild?.members.cache.get(interaction.user.id);
	if (!guildMember && interaction.guild) try {
		guildMember = await interaction.guild.members.fetch(interaction.user.id);
	} catch {
		guildMember = null;
	}
	const hasStaffRole = guildMember?.roles?.cache?.has?.(STAFF_ROLE_ID);
	if (hasStaffRole) return;
	if (interaction.isRepliable()) await interaction.reply({
		content: "This command is only available to the server admins.",
		flags: MessageFlags.Ephemeral
	});
	console.log(`${ctx.commandName} will not be executed!`);
	stopMiddlewares();
}

//#endregion
export { beforeExecute };
//# sourceMappingURL=+middleware.js.map