import { prisma } from '@workspace/db';
import type { DiscordNotificationQueue } from '@workspace/db';

export class DiscordNotificationDAL {
    /**
     * Queue a new Discord notification
     */
    static async queue(data: {
        eventType: string;
        resourceId: string;
        recipientUserId: string;
        payload: Record<string, any>;
    }) {
        return prisma.discordNotificationQueue.create({
            data: {
                ...data,
                payload: JSON.stringify(data.payload),
            },
        });
    }

    /**
     * Get pending Discord notifications (for Arbiter Bot)
     */
    static async getPending(limit: number = 10) {
        return prisma.discordNotificationQueue.findMany({
            where: {
                status: 'pending',
                attemptCount: { lt: 3 }, // Max 3 attempts
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }

    /**
     * Mark notification as sent
     */
    static async markAsSent(id: string) {
        return prisma.discordNotificationQueue.update({
            where: { id },
            data: {
                status: 'sent',
                sentAt: new Date(),
            },
        });
    }

    /**
     * Mark notification as failed
     */
    static async markFailed(id: string, errorMessage: string) {
        return prisma.discordNotificationQueue.update({
            where: { id },
            data: {
                status: 'failed',
                errorMessage,
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(),
            },
        });
    }
}
