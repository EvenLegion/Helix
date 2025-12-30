import { prisma } from '@workspace/db';
import type { AuditLog } from '@workspace/db';

export class AuditLogDAL {
    static async create(data: {
        userId?: string | null;
        action: string;
        resource: string;
        resourceId?: string | null;
        organizationId?: string | null;
        status: 'success' | 'denied' | 'error';
        errorMessage?: string | null;
        changes?: Record<string, any> | null;
        ipAddress?: string | null;
        userAgent?: string | null;
        metadata?: Record<string, any> | null;
    }): Promise<AuditLog> {
        return prisma.auditLog.create({
            data: {
                ...data,
                changes: data.changes ? JSON.stringify(data.changes) : null,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            },
        });
    }

    static async findByUserId(userId: string, limit: number = 50) {
        return prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    static async findByOrganizationId(organizationId: string, limit: number = 100) {
        return prisma.auditLog.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {id: true, email: true, username: true }
                },
            },
        });
    }
}
