import { EmbedBuilder, MessageFlags } from "discord.js";
import { CommandData, ChatInputCommandContext } from "commandkit";

export const command: CommandData = {
    name: 'ruin',
    description: 'Pulls the Latest Information for Ruin Maps for the Contested Zones',
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const guild = interaction.guild;
    const user = interaction.user;


    if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = new EmbedBuilder() // New embed for Ruin Station Contested Zone
        .setColor('#701515') // Should we have different colors for each contested zone?
        .setTitle('Welcome to Ruin Station!')
        .setDescription(`Hello <@${user.id}>, here is the latest information for Ruin Station and where to find the Comp boards inside of Ruin Station Contested Zone.`)
        .addFields(
            {
                name: "Comp Board Five",
                value: "The Fith Comp Board can be found In the Crypt Room, To access the Crypt you will need to work your way through The area Labeled as 'Crypt' the Keycard will be in the Center of that room",
                inline: false,
            },
            {
                name: "Comp Board Six",
                value: "The Sixth Comp Board can be found in the Hallway on the Second Floor leading to the Vault (where the Crypt is located), you will need to go up the stairs an you will see it in the corner of the Room",
                inline: false,
            }
        )
        .setImage('https://i.postimg.cc/1z3fpCwX/Ruin-Map.webp')
        .setFooter({text: "Ruin Station Contested Zone - Map and Information"})


    await interaction.reply({ embeds: [embed] });
}