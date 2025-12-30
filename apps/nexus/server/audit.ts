"use server"

import { headers } from "next/headers"
import { AuditLogDAL } from "@/dal/audit-logs"

export interface AuditLogParams {
    userId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    organizationId?: string | null;
    status: 'success' | 'denied' | 'error';
    errorMessage?: string | null;
    changes?: Record<string, any> | null;
    metadata?: Record<string, any> | null;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
    try {
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
        const userAgent = headersList.get('user-agent') || 'unknown';

        await AuditLogDAL.create({
            ...params,
            ipAddress,
            userAgent,
        });
    } catch (error) {
        // Critical: Never let audit logging failures block main operations
        console.error("Failed to log audit event:", error);
    }
}

export async function logSuccess(params: Omit<AuditLogParams, 'status'>) {
    return logAuditEvent({ ...params, status: 'success' });
}

export async function logDenied(params: Omit<AuditLogParams, 'status'>) {
    return logAuditEvent({ ...params, status: 'denied' });
}

export async function logError(params: Omit<AuditLogParams, 'status'>) {
    return logAuditEvent({ ...params, status: 'error' });
}

