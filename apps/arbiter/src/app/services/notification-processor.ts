import { prisma } from '@workspace/db';
import client from '../../app';
import { EmbedBuilder } from 'discord.js';

const POLL_INTERVAL_MS = 10000; // 10 seconds

export async function startNotificationProcessor() {
    console.log('[Notification Processor] Starting notification processor...');

    setInterval(async () => {
        try {
            await processNotifications();
        } catch (error) {
            console.error('[Notification Processor] Error processing notifications:', error);
        }
    }, POLL_INTERVAL_MS);
}

async function processNotifications() {
    const notifications = await prisma.discordNotificationQueue.findMany({
        where: {
            status: 'pending',
            attemptCount: { lt: 3 },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
    });

    if (notifications.length === 0) return;

    console.log(`[Notification Processor] Processing ${notifications.length} notifications...`);

    for (const notification of notifications) {
        try {
            await sendDiscordDM(notification);

            await prisma.discordNotificationQueue.update({
                where: { id: notification.id },
                data: {
                    status: 'sent',
                    sentAt: new Date(),
                },
            });

            console.log(`[Notification Processor] Notification ${notification.id} sent successfully.`);
        } catch (error) {
            console.error(`[Notification Processor] Error sending notification ${notification.id}:`, error);

            await prisma.discordNotificationQueue.update({
                where: { id: notification.id },
                data: {
                    status: notification.attemptCount >= 2 ? 'failed' : 'pending',
                    attemptCount: { increment: 1 },
                    lastAttemptAt: new Date(),
                },
            });
        }
    }
}

async function sendDiscordDM(notification: any) {
    const payload = JSON.parse(notification.payload || '{}');
    const discordUserId = notification.recipientUserId;

    // Fetch the user from Discord
    const user = await client.users.fetch(discordUserId);

    if (!user) {
        throw new Error(`Discord user with ID ${discordUserId} not found.`);
    }

    let embed: EmbedBuilder;

    if (notification.eventType === 'application_accepted') {
        embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 Application Accepted!')
            .setDescription(`Congratulations! Your application to ${payload.organizationName} has been accepted.`)
            .setFields([
                { name: 'RSI Handle', value: payload.rsiHandle, inline: true },
                { name: 'Reviewed By', value: payload.reviewerName, inline: true },
                {
                    name: 'Next Steps',
                    value: 'You will receive an invite from the organization shortly via RSI to the email address associated with your RSI account. Once received please accept it. Welcome aboard!',
                    inline: false
                },
            ])
            .setTimestamp()
            .setFooter({ text: 'Helix Recruitment System'});
    } else if (notification.eventType === 'application_rejected') {
        embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('📋 Application Status Update')
            .setDescription(`Your application to ${payload.organizationName} has been reviewed.`)
            .setFields([
                { name: 'RSI Handle', value: payload.rsiHandle, inline: true },
                { name: 'Status', value: 'Not Accepted', inline: true },
                {
                    name: 'Feedback',
                    value: payload.reason || 'No specific reason provided.',
                    inline: false
                },
                {
                    name: 'What Now?',
                    value: 'Feel free to reapply in the future if you wish. You are more than welcome to stick around in the public discord community.',
                    inline: false
                }
            ])
            .setTimestamp()
            .setFooter({ text: 'Helix Recruitment System'});
    } else {
        throw new Error(`Unknown event type: ${notification.eventType}`);
    }
    // TODO: Org name still not populating
    // Send the DM
    try {
        await user.send({ embeds: [embed] });
    } catch (dmError) {
        // User has DMs disabled or bot is blocked
        throw new Error(`Failed to send DM to user ${discordUserId}: ${dmError}`);
    }
}
