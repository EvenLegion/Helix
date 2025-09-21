import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";

//#region src/app/events/interactionCreate/nameChangeModal.ts
async function nameChangeModal_default(interaction, client) {
	if (interaction.customId === "name-change-request") {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const newName = interaction.fields.getTextInputValue("new-name");
		const userID = interaction.user.id;
		const member = await interaction.guild?.members.fetch(userID);
		const currentName = member?.nickname ?? interaction.user.username;
		const reason = interaction.fields.getTextInputValue("reason") || "No reason provided";
		const nameChangeRequest = await prisma.nameChangeRequest.create({ data: {
			userId: userID,
			currentName,
			requestedName: newName,
			reason,
			denyReason: " ",
			approved: false,
			approvedBy: null,
			updatedAt: /* @__PURE__ */ new Date()
		} });
		console.log(`A name change request was submitted by ${interaction.user.tag}. The requested name is ${newName}`);
		const requestId = nameChangeRequest.id;
		await interaction.editReply({ content: `We have received your name change request. The requested name is: **${newName}**. The request ID is **${requestId}**` });
		const logChannel = interaction.guild?.channels.cache.get("1388756021790638160");
		if (!logChannel || logChannel.type !== ChannelType.GuildText) return;
		const thread = await logChannel.threads.create({
			name: `Name Change Request - ${interaction.user.displayName}`,
			autoArchiveDuration: 1440,
			reason: `Name change request from ${interaction.user.displayName}`,
			type: ChannelType.PublicThread
		});
		const rolesToPing = ["1378564862245863536"];
		const mentions = `${rolesToPing.map((roleId) => `<@&${roleId}>`).join(" ")}`;
		await thread.send({ content: `${mentions} A new name change request has been submitted by ${member?.nickname ?? interaction.user.username}` });
		const embed = new EmbedBuilder().setTitle("New Name Change Request").setDescription("A new name change request has been submitted.").addFields({
			name: "From",
			value: `<@${interaction.user.id}>`,
			inline: true
		}, {
			name: "Current Name",
			value: currentName,
			inline: true
		}, {
			name: "Requested Name",
			value: newName,
			inline: true
		}, {
			name: "Reason",
			value: reason || "No reason provided",
			inline: false
		}, {
			name: "Request ID",
			value: requestId.toString(),
			inline: true
		}).setColor("Blue").setTimestamp();
		const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`namechange:approve:${nameChangeRequest.id}`).setLabel("✅ Approve").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`namechange:deny:${nameChangeRequest.id}`).setLabel("❌ Deny").setStyle(ButtonStyle.Danger));
		await thread.send({
			embeds: [embed],
			components: [row]
		});
	}
}

//#endregion
export { nameChangeModal_default as default };
//# sourceMappingURL=nameChangeModal.js.map