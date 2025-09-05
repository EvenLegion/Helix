import { EmbedBuilder, MessageFlags } from "discord.js";

//#region src/app/commands/faq/orbituary.ts
const command = {
	name: "orbituary",
	description: "Pulls the Latest Information for Orbituary and Maps for the Contested Zones"
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
	const embed = new EmbedBuilder().setColor("#701515").setTitle("Welcome to Orbituary!").setDescription(`Hello <@${user.id}>, here is the latest information for Orbituary and where to find the Comp boards inside of Orbituary Contested Zone.`).addFields({
		name: "Comp Board Four",
		value: "The Fourth Comp Board can be found behind the Red Security Door (This does require a PYAM-Supervisor Card), after entering the red door you will need to make your way past a Fuse door, look for a Access Vent on the Top of the walls, once you find it proceed to make your way through the vent, you will find your self in a medical room/area you will want to go into the back of the rooms an you will see the Comp board Fabricator",
		inline: false
	}, {
		name: "Comp Board Seven",
		value: "To obtain the Seventh Comp Board you will need to make your way back throu the access vent, once you are back in the main area you will want to make your way back past the Fuse foor an go through another fuse door, after that you will need to go through a Blue SecurityDoor (for this you will need a Blue Security Card witch you can find in the Contested Zone), after that take the elevator down to the Hanger, you will find the comp board in there.",
		inline: false
	}).setImage("https://i.postimg.cc/brhKyvWs/contested-zones-maps-orbituary-ruin-station-checkmate-v0-sb4oko35mbde1.webp").setFooter({ text: "Orbituary Contested Zone - Map and Information" });
	await interaction.reply({ embeds: [embed] });
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=orbituary.js.map