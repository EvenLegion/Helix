import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogDAL } from '@/dal/audit-logs';
import { createTestUser, cleanupTestData } from '../utils/test-helpers';

describe('AuditLogDAL', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    describe('create()', () => {
        it('should create an audit log with all fields', async () => {
            const user = await createTestUser();
            const log = await AuditLogDAL.create({
                userId: user.id,
                action: 'test.action',
                resource: 'test',
                resourceId: 'test-123',
                organizationId: 'org-123',
                status: 'success',
                changes: { before: 'old', after: 'new' },
                metadata: { key: 'value' },
                ipAddress: '127.0.0.1',
                userAgent: 'test-agent'
            });

            expect(log.userId).toBe(user.id);
            expect(log.action).toBe('test.action');
            expect(log.status).toBe('success');
            expect(JSON.parse(log.changes!)).toEqual({ before: 'old', after: 'new' });
        });

        it('should create an audit log with null userId (anonymous)', async () => {
            // Test for failed attempts
            const log = await AuditLogDAL.create({
                userId: null,
                action: 'login.attempt',
                resource: 'authentication',
                status: 'denied',
                ipAddress: '127.0.0.1',
                userAgent: 'test-agent'
            });

            expect(log.userId).toBeNull();
            expect(log.status).toBe('denied');
        });

        it('should stringify JSON fields correctly', async () => {
            // Test metadata and changes JSON handling
            const log = await AuditLogDAL.create({
                action: 'data.update',
                resource: 'data',
                status: 'success',
                changes: { field: 'value' },
                metadata: { info: 'details' },
            });

            expect(JSON.parse(log.changes!)).toEqual({ field: 'value' });
            expect(JSON.parse(log.metadata!)).toEqual({ info: 'details' });
        });
    });

    describe('findByUserId()', () => {
        it('should return logs for specific user', async () => {
            const user1 = await createTestUser({ email: 'user1@test.com' });
            const user2 = await createTestUser({ email: 'user2@test.com' });

            await AuditLogDAL.create({
                userId: user1.id,
                action: 'user1.action1',
                resource: 'test',
                status: 'success',
            });
            await AuditLogDAL.create({
                userId: user1.id,
                action: 'user1.action2',
                resource: 'test',
                status: 'success',
            });
            await AuditLogDAL.create({
                userId: user2.id,
                action: 'user2.action',
                resource: 'test',
                status: 'success',
            });

            const logs = await AuditLogDAL.findByUserId(user1.id);

            expect(logs.length).toBe(2);
            expect(logs.every((log) => log.userId === user1.id)).toBe(true);
        });

        it('should order by createdAt desc', async () => {
            const user = await createTestUser();

            await AuditLogDAL.create({
                userId: user.id,
                action: 'first',
                resource: 'test',
                status: 'success',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            await AuditLogDAL.create({
                userId: user.id,
                action: 'second',
                resource: 'test',
                status: 'success',
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            await AuditLogDAL.create({
                userId: user.id,
                action: 'third',
                resource: 'test',
                status: 'success',
            });

            const logs = await AuditLogDAL.findByUserId(user.id);

            expect(logs[0]?.action).toBe('third');
            expect(logs[1]?.action).toBe('second');
            expect(logs[2]?.action).toBe('first');
        });

        it('should respect limit parameter', async () => {
            const user = await createTestUser();

            for (let i = 0; i < 10; i++) {
                await AuditLogDAL.create({
                    userId: user.id,
                    action: `action-${i}`,
                    resource: 'test',
                    status: 'success',
                });
            }

            const logs = await AuditLogDAL.findByUserId(user.id, 5);

            expect(logs.length).toBe(5);
        });
    });

    describe('findByOrganizationId()', () => {
        it('should return logs for organization with user data', async () => {
            const user = await createTestUser();
            const orgId = 'test-org-123';

            await AuditLogDAL.create({
                userId: user.id,
                action: 'org.action',
                resource: 'organization',
                organizationId: orgId,
                status: 'success',
            });

            const logs = await AuditLogDAL.findByOrganizationId(orgId);

            expect(logs.length).toBe(1);
            expect(logs[0]?.organizationId).toBe(orgId);
            expect(logs[0]?.user).toBeDefined();
            expect(logs[0]?.user?.id).toBe(user.id);
        });

        it('should handle logs with null userId', async () => {
            const orgId = 'test-org-789';

            await AuditLogDAL.create({
                userId: null,
                action: 'anonymous.action',
                resource: 'organization',
                organizationId: orgId,
                status: 'denied',
            });

            const logs = await AuditLogDAL.findByOrganizationId(orgId);

            expect(logs.length).toBe(1);
            expect(logs[0]?.user).toBeNull();
        });
    });

    describe('findFailedAttemps()', () => {
        it('should return only denied and error logs', async () => {
            const user = await createTestUser();

            await AuditLogDAL.create({
                userId: user.id,
                action: 'success.action',
                resource: 'test',
                status: 'success',
            });

            await AuditLogDAL.create({
                userId: user.id,
                action: 'denied.action',
                resource: 'test',
                status: 'denied',
            });

            await AuditLogDAL.create({
                userId: user.id,
                action: 'error.action',
                resource: 'test',
                status: 'error',
            });

            const logs = await AuditLogDAL.findFailedAttemps();

            // Should contain at least our 2 failed logs
            expect(logs.length).toBeGreaterThanOrEqual(2);
            // All logs should be denied or error status
            expect(logs.every((log) => log.status === 'denied' || log.status === 'error')).toBe(
                true,
            );
            // Our specific logs should be included
            const userLogs = logs.filter(log => log.userId === user.id);
            expect(userLogs.length).toBe(2);
        });

        it('should include user data for failed attempts', async () => {
            const user = await createTestUser();

            await AuditLogDAL.create({
                userId: user.id,
                action: 'failed.action',
                resource: 'test',
                status: 'denied',
                errorMessage: 'Access denied',
            });

            const logs = await AuditLogDAL.findFailedAttemps();

            expect((logs[0] as any)?.user).toBeDefined();
            expect((logs[0] as any)?.user?.id).toBe(user.id);
            expect(logs[0]?.errorMessage).toBe('Access denied');
        });

        it('should respect limit parameter', async () => {
            const user = await createTestUser();

            for (let i = 0; i < 10; i++) {
                await AuditLogDAL.create({
                    userId: user.id,
                    action: `failed-${i}`,
                    resource: 'test',
                    status: 'denied',
                });
            }

            const logs = await AuditLogDAL.findFailedAttemps(5);

            expect(logs.length).toBe(5);
        });
    });
});
