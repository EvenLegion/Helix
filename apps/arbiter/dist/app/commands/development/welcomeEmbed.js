import { EmbedBuilder, MessageFlags } from "discord.js";

//#region src/app/commands/development/welcomeEmbed.ts
const command = {
	name: "welcome-test",
	description: "Sends a test welcome message to the specified channel"
};
async function chatInput({ interaction }) {
	const guild = interaction.guild;
	const user = interaction.user;
	if (!guild) return interaction.reply({
		content: "This command can only be used in a server.",
		flags: MessageFlags.Ephemeral
	});
	const welcomeChannel = guild.channels.cache.find((channel) => channel.id === "1378564809120808980");
	if (!welcomeChannel || !welcomeChannel.isTextBased()) return;
	const embed = new EmbedBuilder().setColor("#FF3131").setTitle("Welcome to the Even Legion!").setDescription(`Hello <@${user.id}>, welcome to ${guild.name}! \n \n`).setFields([
		{
			name: "Server-Rules",
			value: "Please make sure to read the <#1299230040223121459> channel to understand the server rules and guidelines.",
			inline: true
		},
		{
			name: "Recruitment",
			value: "If you are interested in joining the Even Legion, please check out the <#1352368731527057438> channel for more information.",
			inline: true
		},
		{
			name: "Role-Select",
			value: "If you are interested in receiving notifications for when EvenLease goes live or when he posts new content, please check out the <#1351702084692480020> channel to select your roles.",
			inline: false
		},
		{
			name: "Charter",
			value: "If you are interested in getting to know how the Even Legion operates, please check out the <#1352376288689786910> channel to read our charter.",
			inline: true
		},
		{
			name: "New Players",
			value: "If you are new to the game, please check out the <#1299214961565761577>. This channel is dedicated to helping new players get started and answering any questions you may have.",
			inline: true
		}
	]).setThumbnail(user.displayAvatarURL()).setTimestamp();
	await welcomeChannel.send({
		content: `<@${user.id}>`,
		embeds: [embed]
	});
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=welcomeEmbed.js.map