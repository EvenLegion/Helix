import { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle} from "discord.js";

export const command: CommandData = {
    name: 'name-change-request',
    description: 'Request a name change'
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    if (!interaction.guild) {
        return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
        .setCustomId('name-change-request')
        .setTitle('Name change')

        .addComponents(
            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('new-name')
                        .setLabel('New Name')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(32)
                ),
            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Reason for name change')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(512)
                )
        );

    await interaction.showModal(modal);
}