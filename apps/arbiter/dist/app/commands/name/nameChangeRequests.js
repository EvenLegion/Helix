import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

//#region src/app/commands/name/nameChangeRequests.ts
const command = {
	name: "name-change-request",
	description: "Request a name change"
};
async function chatInput({ interaction }) {
	if (!interaction.guild) return interaction.reply({
		content: "This command can only be used in a server.",
		flags: MessageFlags.Ephemeral
	});
	const modal = new ModalBuilder().setCustomId("name-change-request").setTitle("Name change").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new-name").setLabel("New Name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Reason for name change").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(512)));
	await interaction.showModal(modal);
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=nameChangeRequests.js.map