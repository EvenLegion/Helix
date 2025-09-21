import { EmbedBuilder, MessageFlags } from "discord.js";

//#region src/app/commands/faq/uniform.ts
const command = {
	name: "uniform",
	description: "Displays information about the Even Legion uniform requirements"
};
async function chatInput({ interaction }) {
	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply({
			content: "This command can only be used in a server.",
			flags: MessageFlags.Ephemeral
		});
		return;
	}
	const embed = new EmbedBuilder().setColor("#FF3131").setTitle("Legion Uniform Standards").setDescription("Check the <#1355376555907485776> channel for the latest uniform standards.").setFields([
		{
			name: "When do we have to wear our uniforms?",
			value: "You are only required to wear your legion uniform when the event specifically tells you to or it is an Elite Op.",
			inline: false
		},
		{
			name: "What happens if I cannot afford the in-game uniform?",
			value: "Please reach out to a commander, we will more than gladly get you a set of armor.",
			inline: false
		},
		{
			name: "What happens if I do not wear a uniform?",
			value: "On events where that Legion uniform is enforced, if you do not wear one of the armors, you will be issued a demerit and you may not be able to participate in the event photo (Up to the commander’s discretion).",
			inline: false
		},
		{
			name: "Why did we pick the armor that we did?",
			value: "Staff has evaluated the uniforms and developed a more streamlined alternative. This reduces our total number of uniforms from 12 to 6. It gives you a choice of light, medium, or heavy, located on the pledge store. A medium set is sold in-game, and a dedicated medic uniform for R.A.F.T. is sold in-game. This makes pictures look more uniform and solidifies our appearance in the verse.",
			inline: false
		}
	]).setTimestamp();
	await interaction.reply({ embeds: [embed] });
}

//#endregion
export { chatInput, command };
//# sourceMappingURL=uniform.js.map