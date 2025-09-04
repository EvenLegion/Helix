import {MessageFlags, Client, ModalSubmitInteraction} from "discord.js";
import { prisma } from "@workspace/db";

export default async function (interaction: ModalSubmitInteraction, client: Client ) {
    // Check if the interaction is a modal-submit interaction
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId && interaction.customId.startsWith('namechange:denyreason:')) {
        const requestId = interaction.customId.split(':')[2];
        const reason = interaction.fields.getTextInputValue('deny-reason');

        // Find the name change request by ID
        const request = await prisma.nameChangeRequest.findUnique({
            where: {
                id: parseInt(requestId!)
            },
        });

        if (!request) {
            return interaction.reply({
                content: 'This name change request does not exist.',
                flags: MessageFlags.Ephemeral
            });
        }

        const member = await interaction.guild?.members.fetch(request.userId);

        request.denyReason = reason;

        await prisma.nameChangeRequest.update({
            where: {
                id: parseInt(requestId!)
            },
            data: {
                denyReason: request.denyReason
            }
        })

        // Notify the user in the thread
        const thread = await interaction.channel?.fetch();

        await member?.send({
            content: `Your name change request has been denied.\n **Reason:** \n ${reason}`
        })

        // Update or delete the ephemeral reply so the modal disappears
        await interaction.reply({
            content: `The user has been notified of the denial.\n**Reason:** \n ${reason}`,
        });

        if (thread && thread.isThread()) {
            await thread.setArchived(true);
        }
    }
}