import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    MessageFlags,
    ModalSubmitInteraction,
    TextChannel
} from "discord.js";
import { prisma } from "@workspace/db"
import { forInteraction } from "@workspace/logger";

export default async function (interaction: ModalSubmitInteraction, client: Client) {

    if (interaction.customId === 'name-change-request') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const newName = interaction.fields.getTextInputValue('new-name');
        const userID = interaction.user.id;
        const member = await interaction.guild?.members.fetch(userID);
        const currentName = member?.nickname ?? interaction.user.username;
        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';

        const nameChangeRequest = await prisma.nameChangeRequest.create({
            data: {
                userId: userID,
                currentName: currentName,
                requestedName: newName,
                reason: reason,
                denyReason: ' ',
                approved: false,
                approvedBy: null,
                updatedAt: new Date(),

            }
        })

        const log = forInteraction(interaction).child({ mod: 'nameChange', action: 'request' });
        log.debug({ requestedName: newName }, 'Name change request submitted');

        //Get the request ID
        const requestId = nameChangeRequest.id;

        // Reply to the interaction with a confirmation message
        await interaction.editReply({ content: `We have received your name change request. The requested name is: **${newName}**. The request ID is **${requestId}**` });

        //Send to requests to thread
        const logChannel = interaction.guild?.channels.cache.get('1388756021790638160') as TextChannel;

        if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

        //Create a new thread for the request
        const thread = await logChannel.threads.create({
            name: `Name Change Request - ${interaction.user.displayName}`,
            autoArchiveDuration: 1440, // Archive after 1440 minutes of inactivity
            reason: `Name change request from ${interaction.user.displayName}`,
            type: ChannelType.PublicThread,
        });

        //Ping the user and staff in the thread
        const rolesToPing = ['1378564862245863536'] // DEV Roles
        //const rolesToPing = ['1302658626795733013', '1378474882811170938' ] // PROD Roles

        const mentions = `${rolesToPing.map(roleId => `<@&${roleId}>`).join(' ')}`;
        await thread.send({ content: `${mentions} A new name change request has been submitted by ${member?.nickname ?? interaction.user.username}` });

        // Creating the embed message
        const embed = new EmbedBuilder()
            .setTitle('New Name Change Request')
            .setDescription('A new name change request has been submitted.')
            .addFields(
                { name: 'From', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Current Name', value: currentName, inline: true },
                { name: 'Requested Name', value: newName, inline: true },
                { name: 'Reason', value: reason || 'No reason provided', inline: false },
                { name: 'Request ID', value: requestId.toString(), inline: true }
            )
            .setColor('Blue')
            .setTimestamp();

        // Creating the interaction buttons
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`namechange:approve:${nameChangeRequest.id}`)
                .setLabel('✅ Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`namechange:deny:${nameChangeRequest.id}`)
                .setLabel('❌ Deny')
                .setStyle(ButtonStyle.Danger),
            /* Uncomment this if you want to add an "Ask for more info" button
            new ButtonBuilder()
                .setCustomId(`namechange:ask:${nameChangeRequest.request_id}`)
                .setLabel('❓ Ask for more info')
                .setStyle(ButtonStyle.Secondary)

             */
        );

        await thread.send({
            embeds: [embed],
            components: [row],
        });
    }
}
