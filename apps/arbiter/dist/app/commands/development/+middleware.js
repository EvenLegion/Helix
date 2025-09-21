import { MessageFlags } from "discord.js";
import { stopMiddlewares } from "commandkit";

//#region src/app/commands/development/+middleware.ts
async function beforeExecute(ctx) {
	if (!ctx.interaction.member.roles.cache.has("1364287451576930326")) {
		const { interaction } = ctx;
		if (interaction.isRepliable()) await interaction.reply({
			content: "This command is only available to the server admins.",
			flags: MessageFlags.Ephemeral
		});
		console.log(`${ctx.commandName} will not be executed!`);
		stopMiddlewares();
	}
}

//#endregion
export { beforeExecute };
//# sourceMappingURL=+middleware.js.map