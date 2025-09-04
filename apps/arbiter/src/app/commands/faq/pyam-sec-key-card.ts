import { EmbedBuilder, MessageFlags } from "discord.js";
import { CommandData, ChatInputCommandContext } from "commandkit";

export const command: CommandData = {
    name: 'redkey',
    description: 'Information on the PYAM-Security KeyCard and where to find it',
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const guild = interaction.guild;
    const user = interaction.user;


    if (!guild) {
        await interaction.reply({content: 'This command can only be used in a server.',flags: MessageFlags.Ephemeral});
        return;
    }

    const embed = new EmbedBuilder() // New embed for PYAM-Security KeyCard
        .setColor('#701515')
        .setTitle('PYAM-Security KeyCard Information')
        .setDescription(`Hello <@${user.id}>, here is the latest information for obtaining the PYAM-Security KeyCard and how to get it.`)
        .addFields(
            {
                name: "PYAM-Security KeyCard",
                value: "The PYAM-Security KeyCard can be found at the PYAM-SUPRVISR Astroid bases in side of the Pyro system, you will need to pull up your starmap an Search for PYAM-SUPRVISR 3-4 or 3-5 after you get there you will have to hide your ship at the AATs will fire at any ship (minus Hoverbikes) one in follow the map provided to find the Card Printer,",
                inline: false,
            }
        )
        .setImage('https://i.postimg.cc/LXRkjLT5/image-2025-06-17-000254349.png')
        .setFooter({text: "PYAM-Security KeyCard - Map and Information"});

    await interaction.reply({ embeds: [embed] });
}