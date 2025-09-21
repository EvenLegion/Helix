import { EmbedBuilder } from "discord.js";

//#region src/app/commands/faq/fleetyard.ts
const command = {
	name: "fleetyard",
	description: "Pulls the Latest Information for Fleetyard and how to join the EvenLegion Fleetyard"
};
async function chatInput({ interaction }) {
	const guild = interaction.guild;
	const user = interaction.user;
	if (!guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			ephemeral: true
		});
		return;
	}
	const embed = new EmbedBuilder().setColor("#701515").setTitle("Welcome to Fleetyard!").setDescription(`Hello <@${user.id}>, here is the latest information for Fleetyard and how to join the EvenLegion Fleetyard.`).addFields({
		name: "Joining the Fleetyard",
		value: "To join the Fleetyard, you will have to go to https://fleetyards.net/login and create an account ",
		inline: false
	}, {
		name: "View the Legion Fleetyard",
		value: "Follow this link to view the Legions Fleetyard: https://fleetyards.net/fleets/evle ",
		inline: false
	}).setImage("https://i.postimg.cc/vBYxCk8B/Discord-Banner-5.gif").setFooter({ text: "Join the EvenLegion Fleetyard Today!" });
	await interaction.reply({ embeds: [embed] });
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=fleetyard.js.map