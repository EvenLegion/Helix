import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { prisma } from "@workspace/db";

//#region src/app/events/interactionCreate/nameChangeButtons.ts
async function nameChangeButtons_default(interaction, client) {
	if (!interaction.isButton()) return;
	if (!interaction.customId.startsWith("namechange:")) return;
	const [, action, requestId] = interaction.customId.split(":");
	const request = await prisma.nameChangeRequest.findUnique({ where: { id: parseInt(requestId) } });
	if (!request) return interaction.reply({
		content: "This name change request does not exist.",
		flags: MessageFlags.Ephemeral
	});
	const member = await interaction.guild?.members.fetch(request.userId);
	if (action === "approve") try {
		await member?.setNickname(request.requestedName);
		await interaction.reply({ content: `Name change request approved. ${request.currentName} is now known as ${request.requestedName}.` });
		await member?.send({ content: `Your name change request has been approved. You are now known as ${request.requestedName} in the ${interaction.guild?.name}.` });
		request.approved = true;
		request.approvedBy = interaction.user.id;
		await prisma.nameChangeRequest.update({
			where: { id: parseInt(requestId) },
			data: {
				approved: request.approved,
				approvedBy: request.approvedBy
			}
		});
		const user = await prisma.user.findUnique({ where: { id: request.userId } });
		if (user) await prisma.user.update({
			where: { id: request.userId },
			data: { nickname: request.requestedName }
		});
		const thread = await interaction.channel?.fetch();
		if (thread && thread.isThread()) await thread.setArchived(true);
	} catch (error) {
		console.error("Failed to change nickname:", error);
		return interaction.reply({
			content: "Failed to change nickname. Please check my permissions.",
			flags: MessageFlags.Ephemeral
		});
	}
	if (action === "deny") {
		request.approved = false;
		request.approvedBy = interaction.user.id;
		await prisma.nameChangeRequest.update({
			where: { id: parseInt(requestId) },
			data: {
				approved: request.approved,
				approvedBy: request.approvedBy
			}
		});
		const modal = new ModalBuilder().setCustomId(`namechange:denyreason:${request.id}`).setTitle("Deny Name Change Request").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("deny-reason").setLabel("Reason for Denial").setStyle(TextInputStyle.Paragraph).setRequired(true)));
		await interaction.showModal(modal);
		return;
	}
}

//#endregion
export { nameChangeButtons_default as default };
//# sourceMappingURL=nameChangeButtons.js.map