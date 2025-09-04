import { CommandData, ChatInputCommandContext } from "commandkit";
import { EmbedBuilder, MessageFlags } from "discord.js";

export const command: CommandData = {
    name: 'exechangar',
    description: 'Pulls the Latest Information on the ships that can be pulled from the exechanger',
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const guild = interaction.guild;
    const user = interaction.user;


    if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = new EmbedBuilder() // New embed for Exechanger Ships // So where are all aware I broke this 5 times making it LUL
        .setColor('#701515')
        .setTitle('Welcome to The ExecHanger Citizen!')
        .setDescription(`Hello <@${user.id}>, here is the latest information for the ships that can be pulled from the exechangers.`)
        .addFields(
            {
                name: "**Ship One**",
                value: "Anvil- F7A MKII Hornet Executive\nhttps://starcitizen.tools/F7A_Hornet_Mk_II", //Best Ship
                inline: false,
            },
            {

                name: "**Ship Two**",
                value: "Anvil- F8 Lightning Executive\nhttps://starcitizen.tools/F8_Lightning", //Best Best Ship
                inline: false,
            },
            {
                name: "**Ship Three**",
                value: "Drake- Cutlass Black Executive\nhttps://starcitizen.tools/Cutlass_Black", //Mehh
                inline: false,
            },
            {
                name: "**Ship Four**",
                value: "Drake- Corsair Executive\nhttps://starcitizen.tools/Corsair", //Strong Mehh
                inline: false,
            },
            {
                name: "**Ship Five**",
                value: "Gatac- Syulen Executive\nhttps://starcitizen.tools/Syulen", //Why CiG why?? like no one wanted this
                inline: false,
            },

        )
        .setImage('https://i.postimg.cc/bNg4YPxr/F7-A-Mk-II-Flying-through-debris-field-jpg.webp')
        .setFooter({text: 'Exechanger Ships - Information'})

    await interaction.reply({ embeds: [embed] });
}