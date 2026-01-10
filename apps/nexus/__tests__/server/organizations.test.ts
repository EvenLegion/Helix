import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogDAL } from '@/dal/audit-logs';
import { RoleDAL } from '@/dal/roles';
import {
    createTestUser,
    createTestOrganization,
    createTestMember,
    createTestSetup,
    cleanupTestData,
} from '../utils/test-helpers';

// Mock modules at the top level - MUST be before imports that use them
vi.mock('@/server/users', async () => {
    const actual = await vi.importActual('@/server/users');
    return {
        ...actual,
        getCurrentUser: vi.fn(),
    };
});

vi.mock('@/server/permissions', async () => {
    const actual = await vi.importActual('@/server/permissions');
    return {
        ...actual,
        checkPermissions: vi.fn(),
    };
});

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue({
        get: vi.fn((header: string) => {
            if (header === 'x-forwarded-for') return '127.0.0.1';
            if (header === 'user-agent') return 'test-agent';
            return null;
        }),
    }),
}));

// Import after mocking
import * as orgActions from '@/server/organizations';
import { getCurrentUser } from '@/server/users';
import { checkPermissions } from '@/server/permissions';

describe('Server Actions - organizations.ts', () => {
    beforeEach(async () => {
        await cleanupTestData();
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    describe('getAllOrganizations()', () => {
        it('should allow admin to list all organizations', async () => {
            // Setup: Create Admin User
            const { user } = await createTestSetup('owner');
            const org2 = await createTestOrganization({ slug: 'org-2' });

            // Mock getCurrentUser to return admin user
            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: null } as any,
                member: null,
            } as any);

            // Mock checkPermissions to return true (has admin permission)
            vi.mocked(checkPermissions).mockResolvedValue(true);

            // Act
            const result = await orgActions.getAllOrganizations();

            // Verify Audit Log created
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('organization.list_all');
            expect(logs[0]?.status).toBe('success');
        });

        it('should deny non-admin from listing all organizations', async () => {
            // Setup: Create Regular User
            const { user } = await createTestSetup('user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: null } as any,
                member: null,
            } as any);

            // Mock checkPermissions to return false (lacks admin permission)
            vi.mocked(checkPermissions).mockResolvedValue(false);

            // Act
            await expect(orgActions.getAllOrganizations()).rejects.toThrow(
                'Unauthorized: Insufficient permissions',
            );

            // Verify Audit Log created
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('organization.list_all');
            expect(logs[0]?.status).toBe('denied');
            expect(logs[0]?.errorMessage).toContain('lacks permission');
        });
    });

    describe('deleteOrganization()', () => {
        it('should allow owner to delete organization', async () => {
            // Setup: Create Owner User and Organization
            const { user, org } = await createTestSetup('owner');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            const result = await orgActions.deleteOrganization(org.id);

            expect(result.success).toBe(true);

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('organization.delete');
            expect(logs[0]?.status).toBe('success');
        });

        it('should deny non-owner from deleting organization', async () => {
            const { user, org } = await createTestSetup('user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            await expect(orgActions.deleteOrganization(org.id)).rejects.toThrow(
                'Only owners can delete'
            );

            // Verify denied audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.status).toBe('denied');
        });

        it('should deny non-member from deleting organization', async () => {
            // Setup: Create two separate organizations
            const { user: user1, org: org1 } = await createTestSetup('owner');
            const org2 = await createTestOrganization({ slug: 'org-2' });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user1,
                session: { activeOrganizationId: org1.id } as any,
                member: null,
            } as any);

            // Act & Assert - user1 tries to delete org2 (not a member)
            await expect(orgActions.deleteOrganization(org2.id)).rejects.toThrow(
                'You are not a member of this organization',
            );

            // Verify denied audit log
            const logs = await AuditLogDAL.findByUserId(user1.id);
            expect(logs[0]?.action).toBe('organization.delete');
            expect(logs[0]?.status).toBe('denied');
            expect(logs[0]?.errorMessage).toBe('Not a member');
        });
    });

    describe('updateOrganizationRole()', () => {
        it('should allow owner to update role permissions', async () => {
            const { user, org } = await createTestSetup('owner');

            // Create a role first
            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'moderator',
                permission: JSON.stringify({ member: ['read'] })
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            const newPermissions = { member: ['read', 'update'] };
            const result = await orgActions.updateOrganizationRole(
                role.id,
                org.id,
                newPermissions
            );

            expect(result).toBeDefined();

            // Verify audit log with changes
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.update');
            expect(logs[0]?.status).toBe('success');
            const changes = JSON.parse(logs[0]?.changes!);
            expect(changes.before).toEqual({ member: ['read'] });
            expect(changes.after).toEqual(newPermissions);
        });

        it('should allow user with ac:update permission', async () => {
            const { user, org } = await createTestSetup('moderator');

            // Create a role first
            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'editor',
                permission: JSON.stringify({ member: ['read'] }),
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            // User has ac:update permission (not owner)
            vi.mocked(checkPermissions).mockResolvedValue(true);

            const newPermissions = { member: ['read', 'update'] };
            const result = await orgActions.updateOrganizationRole(
                role.id,
                org.id,
                newPermissions,
            );

            expect(result).toBeDefined();

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.update');
            expect(logs[0]?.status).toBe('success');
        });

        it('should deny user without permission', async () => {
            const { user, org } = await createTestSetup('user');

            // Create a role first
            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'editor',
                permission: JSON.stringify({ member: ['read'] }),
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            // User lacks ac:update and is not owner
            vi.mocked(checkPermissions).mockResolvedValue(false);

            const newPermissions = { member: ['read', 'update'] };

            await expect(
                orgActions.updateOrganizationRole(role.id, org.id, newPermissions),
            ).rejects.toThrow('Unauthorized: Insufficient permissions to update role');

            // Verify denied audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.update');
            expect(logs[0]?.status).toBe('denied');
            expect(logs[0]?.errorMessage).toContain('Insufficient permissions');
        });
    });

    describe('getActiveOrganization()', () => {
        it('should allow user to query own active organization', async () => {
            const { user, org } = await createTestSetup('owner');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            const result = await orgActions.getActiveOrganization(user.id);

            expect(result?.id).toBe(org.id);
        });

        it('should allow admin to query other users organization', async () => {
            // Create two users
            const admin = await createTestUser({ email: 'admin@test.com' });
            const { user: targetUser, org } = await createTestSetup('user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: admin,
                session: { activeOrganizationId: null } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            const result = await orgActions.getActiveOrganization(targetUser.id);

            expect(result?.id).toBe(org.id);
        });

        it('should deny non-admin from querying other users', async () => {
            // Create two users
            const { user: user1, org: org1 } = await createTestSetup('user');
            const { user: user2, org: org2 } = await createTestSetup('user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user1,
                session: { activeOrganizationId: org1.id } as any,
                member: null,
            } as any);

            // User1 is not admin, so cannot query user2
            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(orgActions.getActiveOrganization(user2.id)).rejects.toThrow(
                'Unauthorized: You can only query your own active organization',
            );

            // Verify denied audit log
            const logs = await AuditLogDAL.findByUserId(user1.id);
            expect(logs[0]?.action).toBe('organization.get_active');
            expect(logs[0]?.status).toBe('denied');
        });
    });

    describe('deleteOrganizationRole()', () => {
        it('should allow deletion of unused role', async () => {
            const { user, org } = await createTestSetup('owner');

            // Create a role that's not assigned to anyone
            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'test-role',
                permission: JSON.stringify({ member: ['read'] }),
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            const result = await orgActions.deleteOrganizationRole(role.id, org.id);

            expect(result.success).toBe(true);

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.delete');
            expect(logs[0]?.status).toBe('success');
        });

        it('should prevent deletion of role in use', async () => {
            const { user, org } = await createTestSetup('owner');

            // Create a role
            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'in-use-role',
                permission: JSON.stringify({ member: ['read'] }),
            });

            // Create another user with this role
            const user2 = await createTestUser({ email: 'user2@test.com' });
            await createTestMember(user2.id, org.id, 'in-use-role');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(
                orgActions.deleteOrganizationRole(role.id, org.id),
            ).rejects.toThrow('Cannot delete role');

            // Verify audit log with member count
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.delete');
            expect(logs[0]?.status).toBe('denied');
            expect(logs[0]?.errorMessage).toContain('assigned to');
        });

        it('should deny user without permission', async () => {
            const { user, org } = await createTestSetup('user');

            const role = await RoleDAL.create({
                organizationId: org.id,
                role: 'test-role',
                permission: JSON.stringify({ member: ['read'] }),
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(
                orgActions.deleteOrganizationRole(role.id, org.id),
            ).rejects.toThrow('Unauthorized: Insufficient permissions to delete role');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('role.delete');
            expect(logs[0]?.status).toBe('denied');
        });
    });

    describe('searchUsers()', () => {
        it('should allow admin to search users', async () => {
            const { user: admin } = await createTestSetup('owner');
            await createTestUser({ email: 'searchable@test.com', username: 'searchable' });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: admin,
                session: { activeOrganizationId: null } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            const results = await orgActions.searchUsers('searchable');

            expect(results.length).toBeGreaterThan(0);

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(admin.id);
            expect(logs[0]?.action).toBe('user.search');
            expect(logs[0]?.status).toBe('success');
        });

        it('should deny non-admin from searching', async () => {
            const { user } = await createTestSetup('user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: null } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(orgActions.searchUsers('test')).rejects.toThrow(
                'Unauthorized: Insufficient permissions to search users',
            );

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('user.search');
            expect(logs[0]?.status).toBe('denied');
        });
    });

    describe('addUserToOrganization()', () => {
        it('should allow adding user with member:create permission', async () => {
            const { user: adder, org } = await createTestSetup('owner');
            const newUser = await createTestUser({ email: 'new@test.com' });

            // Create a custom "user" role in the organization
            await RoleDAL.create({
                organizationId: org.id,
                role: 'user',
                permission: JSON.stringify({ member: ['read'] }),
            });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: adder,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            const result = await orgActions.addUserToOrganization(
                newUser.id,
                org.id,
                'user'
            );

            expect(result.userId).toBe(newUser.id);

            // Verify audit log with user details
            const logs = await AuditLogDAL.findByUserId(adder.id);
            expect(logs[0]?.action).toBe('member.create');
            expect(logs[0]?.status).toBe('success');
        });

        it('should deny adding already-existing member', async () => {
            const { user: adder, org, member } = await createTestSetup('owner');
            const existingUser = await createTestUser({ email: 'existing@test.com' });
            await createTestMember(existingUser.id, org.id, 'user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: adder,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            await expect(
                orgActions.addUserToOrganization(existingUser.id, org.id, 'user'),
            ).rejects.toThrow('User is already a member of this organization');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(adder.id);
            expect(logs[0]?.action).toBe('member.create');
            expect(logs[0]?.status).toBe('denied');
        });

        it('should deny adding with non-existent role', async () => {
            const { user: adder, org } = await createTestSetup('owner');
            const newUser = await createTestUser({ email: 'new2@test.com' });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: adder,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            await expect(
                orgActions.addUserToOrganization(newUser.id, org.id, 'nonexistent-role'),
            ).rejects.toThrow('does not exist in this organization');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(adder.id);
            expect(logs[0]?.action).toBe('member.create');
            expect(logs[0]?.status).toBe('denied');
        });

        it('should deny user without member:create permission', async () => {
            const { user, org } = await createTestSetup('user');
            const newUser = await createTestUser({ email: 'new3@test.com' });

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(
                orgActions.addUserToOrganization(newUser.id, org.id, 'user'),
            ).rejects.toThrow('Unauthorized: Insufficient permissions to add members');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('member.create');
            expect(logs[0]?.status).toBe('denied');
        });
    });

    describe('deleteMemberFromOrganization()', () => {
        it('should allow removing member with permission', async () => {
            const { user: remover, org } = await createTestSetup('owner');
            const userToRemove = await createTestUser({ email: 'remove@test.com' });
            const memberToRemove = await createTestMember(userToRemove.id, org.id, 'user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: remover,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            const result = await orgActions.deleteMemberFromOrganization(memberToRemove.id);

            expect(result.success).toBe(true);

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(remover.id);
            expect(logs[0]?.action).toBe('member.delete');
            expect(logs[0]?.status).toBe('success');
        });

        it('should prevent self-removal', async () => {
            const { user, org, member } = await createTestSetup('owner');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            await expect(
                orgActions.deleteMemberFromOrganization(member.id),
            ).rejects.toThrow('You cannot remove yourself from the organization');

            // Verify audit log denial
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('member.delete');
            expect(logs[0]?.status).toBe('denied');
            expect(logs[0]?.errorMessage).toBe('Cannot remove self');
        });

        it('should prevent removing owner', async () => {
            const { user: admin, org: org1 } = await createTestSetup('admin');
            const { user: owner, org: org2, member: ownerMember } = await createTestSetup('owner');

            // Add admin to owner's org
            await createTestMember(admin.id, org2.id, 'admin');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: admin,
                session: { activeOrganizationId: org2.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(true);

            await expect(
                orgActions.deleteMemberFromOrganization(ownerMember.id),
            ).rejects.toThrow('You cannot remove the owner from the organization');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(admin.id);
            expect(logs[0]?.action).toBe('member.delete');
            expect(logs[0]?.status).toBe('denied');
        });

        it('should deny user without member:delete permission', async () => {
            const { user, org } = await createTestSetup('user');
            const userToRemove = await createTestUser({ email: 'remove2@test.com' });
            const memberToRemove = await createTestMember(userToRemove.id, org.id, 'user');

            vi.mocked(getCurrentUser).mockResolvedValue({
                currentUser: user,
                session: { activeOrganizationId: org.id } as any,
                member: null,
            } as any);

            vi.mocked(checkPermissions).mockResolvedValue(false);

            await expect(
                orgActions.deleteMemberFromOrganization(memberToRemove.id),
            ).rejects.toThrow('Unauthorized: You do not have permission to remove members');

            // Verify audit log
            const logs = await AuditLogDAL.findByUserId(user.id);
            expect(logs[0]?.action).toBe('member.delete');
            expect(logs[0]?.status).toBe('denied');
        });
    });
});
