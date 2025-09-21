import { EmbedBuilder, MessageFlags } from "discord.js";

//#region src/app/commands/faq/checkmate.ts
const command = {
	name: "checkmate",
	description: "Pulls the Latest Information for Checkmate an Maps for the Contested Zones"
};
async function chatInput({ interaction }) {
	const guild = interaction.guild;
	const user = interaction.user;
	if (!guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const embed = new EmbedBuilder().setColor("#701515").setTitle("Welcome to Checkmate!").setDescription(`Hello <@${user.id}>, here is the latest information for Checkmate and where to find the Comp boards inside of Checkmate Contested Zone.`).addFields({
		name: "Comp Board One",
		value: "The first Comp Board can be found Through the Red Security Door (this does require a PYAM-Supervisor Card), after entering the Red door you will want to make your way to the market section the Comp board printer will be found Under a set of stairs",
		inline: false
	}, {
		name: "Comp Board Two",
		value: "The Second Comp Board can be found behind the Blue Security Door (this does require a Blue Security Card), after entering the Blue door you will want to make your way through the Contested zone until you find the last room, you will want to look for stair cases/ladders to get to the bottom floor, on the Left side is Comp Board two.",
		inline: false
	}, {
		name: "Comp Board Three",
		value: "Comp Board Three can be found in the same room as Comp Board Two, but on the Right side of the room.",
		inline: false
	}).setImage("https://i.postimg.cc/pVwrDpd9/contested-zones-maps-orbituary-ruin-station-checkmate-v0-tc3na435mbde1.webp").setFooter({ text: "Checkmate Contested Zone - Map and Information" });
	await interaction.reply({ embeds: [embed] });
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=checkmate.js.map