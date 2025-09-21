import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";

//#region src/app/events/interactionCreate/nameChangeDenied.ts
async function nameChangeDenied_default(interaction, client) {
	if (!interaction.isModalSubmit()) return;
	if (interaction.customId && interaction.customId.startsWith("namechange:denyreason:")) {
		const requestId = interaction.customId.split(":")[2];
		const reason = interaction.fields.getTextInputValue("deny-reason");
		const request = await prisma.nameChangeRequest.findUnique({ where: { id: parseInt(requestId) } });
		if (!request) return interaction.reply({
			content: "This name change request does not exist.",
			flags: MessageFlags.Ephemeral
		});
		const member = await interaction.guild?.members.fetch(request.userId);
		request.denyReason = reason;
		await prisma.nameChangeRequest.update({
			where: { id: parseInt(requestId) },
			data: { denyReason: request.denyReason }
		});
		const thread = await interaction.channel?.fetch();
		await member?.send({ content: `Your name change request has been denied.\n **Reason:** \n ${reason}` });
		await interaction.reply({ content: `The user has been notified of the denial.\n**Reason:** \n ${reason}` });
		if (thread && thread.isThread()) await thread.setArchived(true);
	}
}

//#endregion
export { nameChangeDenied_default as default };
//# sourceMappingURL=nameChangeDenied.js.map