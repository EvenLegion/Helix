import {
    ActionRowBuilder,
    ButtonInteraction,
    Client,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";

export default async function (interaction: ButtonInteraction, client: Client) {
    // Check if the interaction is a button interaction
    if (!interaction.isButton()) return;

    // Check if the interaction is for a name change button
    if (!interaction.customId.startsWith('namechange:')) return;

    // Assign action and requestId from the customId
    const [, action, requestId] = interaction.customId.split(':');

    const request = await prisma.nameChangeRequest.findUnique({
        where: {
            id: parseInt(requestId!)
        }
    })

    if (!request) {
        return interaction.reply({
            content: 'This name change request does not exist.',
            flags: MessageFlags.Ephemeral
        });
    }

    const member = await interaction.guild?.members.fetch(request.userId);

    if (action === 'approve') {
        const log = forInteraction(interaction).child({ mod: 'nameChange', action: 'approve', requestId });

        // Change the member's nickname
        try {
            await member?.setNickname(request.requestedName);
            await interaction.reply({
                content: `Name change request approved. ${request.currentName} is now known as ${request.requestedName}.`,
            });
            // Notify the user via DM
            await member?.send({
                content: `Your name change request has been approved. You are now known as ${request.requestedName} in the ${interaction.guild?.name}.`
            })

            // Approve the name change request
            request.approved = true;
            request.approvedBy = interaction.user.id;
            await prisma.nameChangeRequest.update({
                where: { id: parseInt(requestId!) },
                data: { approved: request.approved, approvedBy: request.approvedBy }
            })

            // Update the user in the database
            const user = await prisma.user.findUnique({ where: { id: request.userId } });
            if (user) {
                await prisma.user.update({ where: { id: request.userId }, data: { preferredName: request.requestedName, nickname: request.requestedName } })
            }

            // Archive the thread
            const thread = await interaction.channel?.fetch();
            if (thread && thread.isThread()) {
                await thread.setArchived(true);
            }
        } catch (error: any) {
            const truthy = new Set(['1', 'true', 'yes', 'on']);
            const DEV_BYPASS = truthy.has(String(process.env.DEV_ALLOW_NICK_EDIT || '').toLowerCase()) || truthy.has(String(process.env.ALLOW_NICK_DEV_APPROVE || '').toLowerCase());
            const missingPerms = error?.code === 50013 || String(error?.message || '').includes('Missing Permissions');
            if (DEV_BYPASS && missingPerms) {
                log.warn('Dev bypass: missing permissions; proceeding with approval without changing nickname.');
                // Proceed with approval and DB updates without changing the nickname
                await interaction.reply({
                    content: `Name change request approved (dev bypass). ${request.currentName} would be set to ${request.requestedName}, but bot lacks permissions in this environment.`,
                });
                // DM the user with a dev-bypass notice (optional)
                try {
                    await member?.send({
                        content: `Your name change request was approved. In this test environment, the bot couldn't change your nickname automatically. Staff will apply it if needed.`
                    });
                } catch { }

                request.approved = true;
                request.approvedBy = interaction.user.id;
                await prisma.nameChangeRequest.update({
                    where: { id: parseInt(requestId!) },
                    data: { approved: request.approved, approvedBy: request.approvedBy }
                });

                const user = await prisma.user.findUnique({ where: { id: request.userId } });
                if (user) {
                    await prisma.user.update({ where: { id: request.userId }, data: { preferredName: request.requestedName, nickname: request.requestedName } });
                }

                const thread = await interaction.channel?.fetch();
                if (thread && thread.isThread()) {
                    await thread.setArchived(true);
                }
                return;
            }
            log.error({ err: error }, 'Failed to change nickname');
            return interaction.reply({
                content: 'Failed to change nickname. Please check my permissions.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (action === 'deny') {
        // Deny the name change request
        request.approved = false;
        request.approvedBy = interaction.user.id;

        await prisma.nameChangeRequest.update({
            where: {
                id: parseInt(requestId!),
            },
            data: {
                approved: request.approved,
                approvedBy: request.approvedBy
            }
        })

        const modal = new ModalBuilder()
            .setCustomId(`namechange:denyreason:${request.id}`)
            .setTitle('Deny Name Change Request')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('deny-reason')
                        .setLabel('Reason for Denial')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            )

        await interaction.showModal(modal)
        return;
    }
    /*
    COMMENTING OUT ASK ACTION FOR NOW MAY IMPLEMENT LATER
        if (action === 'ask') {
            // Ask for more information
            const modal = new ModalBuilder()
                .setCustomId(`namechange:ask:${request.request_id}`)
                .setTitle('Ask for More Information')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('ask-reason')
                            .setLabel('Reason for Asking')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                )

            await interaction.showModal(modal)
            return;
        }
    */
}