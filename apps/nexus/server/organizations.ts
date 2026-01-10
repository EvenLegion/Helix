'use server';

import { prisma } from '@workspace/db';
import { getCurrentUser } from './users';
import { OrganizationDAL } from '@/dal/organizations';
import { MemberDAL } from '@/dal/members';
import { RoleDAL } from '@/dal/roles';
import { UserDAL } from '@/dal/users';
import { checkPermissions } from './permissions';
import { logSuccess, logDenied } from './audit';

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser();

    return currentUser;
}

export async function getAllOrganizations() {
    const { currentUser } = await getCurrentUser();

    // TODO: Modify Permissions
    const hasPermission = await checkPermissions({ admin: ['admin_dashboard'] });

    if (!hasPermission) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.list_all',
            resource: 'organization',
            errorMessage: 'User lacks permission to list all organizations',
        });
        throw new Error('Unauthorized: Insufficient permissions');
    }

    const organizations = await OrganizationDAL.findAll();

    await logSuccess({
        userId: currentUser.id,
        action: 'organization.list_all',
        resource: 'organization',
        metadata: { count: organizations.length },
    });

    return organizations;
}

/**
 * Internal helper for auth hooks - does NOT check permissions
 * Only use this from auth.ts database hooks
 */
export async function getActiveOrganizationInternal(userId: string) {
    const memberUser = await MemberDAL.findByUserId(userId);

    if (!memberUser) {
        return null;
    }

    const organization = await OrganizationDAL.findById(memberUser.organizationId);
    return organization;
}

export async function getActiveOrganization(userId: string) {
    const { currentUser } = await getCurrentUser();

    const isSelf = currentUser?.id === userId;
    // TODO: Modify Permissions
    const isAdmin = !isSelf && (await checkPermissions({ admin: ['admin_dashboard'] }));

    if (!isSelf && !isAdmin) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.get_active',
            resource: 'organization',
            errorMessage: 'Cannot query other users',
            metadata: { requestedUserId: userId },
        });
        throw new Error('Unauthorized: You can only query your own active organization');
    }

    const memberUser = await MemberDAL.findByUserId(userId);

    if (!memberUser) {
        await logSuccess({
            userId: currentUser?.id,
            action: 'organization.get_active',
            resource: 'organization',
            metadata: { requestedUserId: userId, found: false },
        });
        return null;
    }

    const organization = await OrganizationDAL.findById(memberUser.organizationId);

    await logSuccess({
        userId: currentUser?.id,
        action: 'organization.get_active',
        resource: 'organization',
        resourceId: organization?.id,
        organizationId: organization?.id,
        metadata: { requestedUserId: userId },
    });

    return organization;
}

export async function updateOrganizationRole(
    roleId: string,
    organizationId: string,
    permission: Record<string, string[]>,
) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'role.update',
            resource: 'role',
            resourceId: roleId,
            organizationId,
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    // Verify the role belongs to the organization
    const existingRole = await RoleDAL.findByIdAndOrganizationId(roleId, organizationId);

    if (!existingRole) {
        await logDenied({
            userId: currentUser.id,
            action: 'role.update',
            resource: 'role',
            resourceId: roleId,
            organizationId,
            errorMessage: 'Role not found',
        });
        throw new Error('Role not found or does not belong to this organization');
    }

    //Check permissions
    const hasPermission = await checkPermissions({ ac: ['update'] });
    if (!hasPermission) {
        const member = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

        const isOwner = member?.role
            .split(',')
            .map((r) => r.trim())
            .includes('owner');

        if (!isOwner) {
            await logDenied({
                userId: currentUser.id,
                action: 'role.update',
                resource: 'role',
                resourceId: roleId,
                organizationId,
                errorMessage: 'Insufficient permissions to update role',
                metadata: { userRole: member?.role },
            });
            throw new Error('Unauthorized: Insufficient permissions to update role');
        }
    }

    // Update the role with new permissions
    const updatedRole = await RoleDAL.updatePermissions(roleId, permission);

    await logSuccess({
        userId: currentUser.id,
        action: 'role.update',
        resource: 'role',
        resourceId: roleId,
        organizationId,
        changes: {
            before: JSON.parse(existingRole.permission),
            after: permission,
        },
        metadata: { updatedPermissions: permission },
    });

    return updatedRole;
}

export async function deleteOrganization(organizationId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'organization.delete',
            resource: 'organization',
            resourceId: organizationId,
            organizationId,
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    // Verify user is a member of this organization
    const member = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

    if (!member) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.delete',
            resource: 'organization',
            resourceId: organizationId,
            organizationId,
            errorMessage: 'Not a member',
        });
        throw new Error('You are not a member of this organization');
    }

    // CHECK: Only owners can delete the organization
    const memberRoles = member.role.split(',').map((r) => r.trim());
    const isOwner = memberRoles.includes('owner');

    if (!isOwner) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.delete',
            resource: 'organization',
            resourceId: organizationId,
            organizationId,
            errorMessage: 'Only owners can delete the organization',
            metadata: { userRole: member.role },
        });
        throw new Error('Unauthorized: Only owners can delete the organization');
    }

    const org = await OrganizationDAL.findById(organizationId);
    await OrganizationDAL.delete(organizationId);

    await logSuccess({
        userId: currentUser.id,
        action: 'organization.delete',
        resource: 'organization',
        resourceId: organizationId,
        organizationId,
        metadata: { organizationName: org?.name },
    });

    return { success: true };
}

export async function deleteOrganizationRole(roleId: string, organizationId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'role.delete',
            resource: 'role',
            resourceId: roleId,
            organizationId,
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    const existingRole = await RoleDAL.findByIdAndOrganizationId(roleId, organizationId);

    if (!existingRole) {
        await logDenied({
            userId: currentUser.id,
            action: 'role.delete',
            resource: 'role',
            resourceId: roleId,
            organizationId,
            errorMessage: 'Role not found',
        });
        throw new Error('Role not found or does not belong to this organization');
    }

    //Check permissions ac:delete or owner
    const hasPermission = await checkPermissions({ ac: ['delete'] });

    if (!hasPermission) {
        const member = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

        const isOwner = member?.role
            .split(',')
            .map((r) => r.trim())
            .includes('owner');

        if (!isOwner) {
            await logDenied({
                userId: currentUser.id,
                action: 'role.delete',
                resource: 'role',
                resourceId: roleId,
                organizationId,
                errorMessage: 'Lacks ac:delete permission or owner role',
                metadata: { userRole: member?.role },
            });
            throw new Error('Unauthorized: Insufficient permissions to delete role');
        }
    }

    // Check if any members use this role
    const membersUsingRole = await MemberDAL.findByOrganizationIdWithRole(organizationId, existingRole.role);

    const membersWithRole = membersUsingRole.filter((member) => {
        const memberRoles = member.role.split(',').map((r) => r.trim());
        return memberRoles.includes(existingRole.role);
    });

    if (membersWithRole.length > 0) {
        await logDenied({
            userId: currentUser.id,
            action: 'role.delete',
            resource: 'role',
            resourceId: roleId,
            organizationId,
            errorMessage: `Role is assigned to ${membersWithRole.length} members`,
            metadata: {
                roleName: existingRole.role,
                memberCount: membersWithRole.length,
            },
        });
        throw new Error(
            `Cannot delete role "${existingRole.role}" as it is assigned to ${membersWithRole.length} members`,
        );
    }

    await RoleDAL.delete(roleId);

    await logSuccess({
        userId: currentUser.id,
        action: 'role.delete',
        resource: 'role',
        resourceId: roleId,
        organizationId,
        metadata: { roleName: existingRole.role },
    });

    return { success: true };
}

/**
 * Search for users by email or username
 */
export async function searchUsers(query: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'user.search',
            resource: 'user',
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    // TODO: Modify Permissions
    const hasPermission = await checkPermissions({ admin: ['admin_dashboard'] });

    if (!hasPermission) {
        await logDenied({
            userId: currentUser.id,
            action: 'user.search',
            resource: 'user',
            errorMessage: 'Lacks admin permissions',
        });
        throw new Error('Unauthorized: Insufficient permissions to search users');
    }

    const results = await UserDAL.search(query);

    await logSuccess({
        userId: currentUser.id,
        action: 'user.search',
        resource: 'user',
        metadata: { query, resultCount: results.length },
    });

    return results;
}

/**
 * Add a user to an organization
 */
export async function addUserToOrganization(userId: string, organizationId: string, role: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'member.create',
            resource: 'member',
            organizationId,
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    const currentUserMember = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

    if (!currentUserMember) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.create',
            resource: 'member',
            organizationId,
            errorMessage: 'Not a member of the organization',
        });
        throw new Error('You are not a member of this organization');
    }

    // Check permissions: member create
    const hasPermission = await checkPermissions({ member: ['create'] });

    if (!hasPermission) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.create',
            resource: 'member',
            organizationId,
            errorMessage: 'Insufficient permissions to add members: member.create',
        });
        throw new Error('Unauthorized: Insufficient permissions to add members');
    }

    const user = await UserDAL.findById(userId);

    if (!user) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.create',
            resource: 'member',
            organizationId,
            errorMessage: 'User to add not found',
            metadata: { userIdToAdd: userId },
        });
        throw new Error('User not found');
    }

    const existingMember = await MemberDAL.findByUserIdAndOrganizationId(userId, organizationId);

    if (existingMember) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.create',
            resource: 'member',
            organizationId,
            errorMessage: 'User is already a member of the organization',
            metadata: { userIdToAdd: userId },
        });
        throw new Error('User is already a member of this organization');
    }

    if (role !== 'owner') {
        const orgRole = await RoleDAL.findByRoleNameAndOrganizationId(role, organizationId);

        if (!orgRole) {
            await logDenied({
                userId: currentUser.id,
                action: 'member.create',
                resource: 'member',
                organizationId,
                errorMessage: `Role "${role}" does not exist in organization`,
                metadata: { targetUserId: userId, requestedRole: role },
            });
            throw new Error(`Role "${role}" does not exist in this organization`);
        }
    }

    const member = await MemberDAL.create({
        userId,
        organizationId,
        role,
    });

    await logSuccess({
        userId: currentUser.id,
        action: 'member.create',
        resource: 'member',
        resourceId: member.id,
        organizationId,
        metadata: {
            targetUserId: userId,
            targetUserEmail: user.email,
            assignedRole: role,
        },
    });

    return member;
}

export async function deleteMemberFromOrganization(memberId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'member.delete',
            resource: 'member',
            errorMessage: 'Unauthenticated',
        });
        throw new Error('Unauthorized');
    }

    const memberToRemove = await MemberDAL.findById(memberId);

    if (!memberToRemove) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.delete',
            resource: 'member',
            resourceId: memberId,
            errorMessage: 'Member not found',
        });
        throw new Error('Member not found');
    }

    const organizationId = memberToRemove.organizationId;

    const currentUserMember = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

    if (!currentUserMember) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.delete',
            resource: 'member',
            resourceId: memberId,
            organizationId,
            errorMessage: 'Not a member',
        });
        throw new Error('You are not a member of this organization');
    }

    // Check permission: member:delete
    const hasPermission = await checkPermissions({ member: ['delete'] });

    if (!hasPermission) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.delete',
            resource: 'member',
            resourceId: memberId,
            organizationId,
            errorMessage: 'Lacks member:delete',
            metadata: { userRole: currentUserMember.role },
        });
        throw new Error('Unauthorized: You do not have permission to remove members');
    }

    if (currentUserMember.userId === memberToRemove.userId) {
        await logDenied({
            userId: currentUser.id,
            action: 'member.delete',
            resource: 'member',
            resourceId: memberId,
            organizationId,
            errorMessage: 'Cannot remove self',
        });
        throw new Error('You cannot remove yourself from the organization');
    }

    if (memberToRemove.role === 'owner') {
        await logDenied({
            userId: currentUser.id,
            action: 'member.delete',
            resource: 'member',
            resourceId: memberId,
            organizationId,
            errorMessage: 'Cannot remove owner',
            metadata: { targetUserId: memberToRemove.userId },
        });
        throw new Error('You cannot remove the owner from the organization');
    }

    await MemberDAL.delete(memberId);

    await logSuccess({
        userId: currentUser.id,
        action: 'member.delete',
        resource: 'member',
        resourceId: memberId,
        organizationId,
        metadata: {
            removedUserId: memberToRemove.userId,
            removedUserRole: memberToRemove.role,
        },
    });

    return { success: true };
}

/**
 * Allow owners to assign themselves additional roles
 * Bypasses better-auth's self-modification restriction
 * SECURITY: Only owners can use this, and owner role cannot be removed
 */
export async function updateSelfMemberRole(organizationId: string, roles: string[]) {
    // 1. Get current user
    const { currentUser } = await getCurrentUser();
    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // 2. Find the member record for the current user
    const member = await MemberDAL.findByUserIdAndOrganizationId(currentUser.id, organizationId);

    if (!member) {
        throw new Error('You are not a member of this organization');
    }

    // 3. CRITICAL VALIDATION: Check if user is currently an owner
    const currentRoles = member.role.split(',').map((r) => r.trim());
    const isOwner = currentRoles.includes('owner');

    if (!isOwner) {
        throw new Error('Only owners can assign themselves roles');
    }

    // 4. CRITICAL VALIDATION: Ensure 'owner' role is preserved
    if (!roles.includes('owner')) {
        throw new Error('Cannot remove owner role from yourself');
    }

    // 5. Validate all requested roles exist in the organization
    const validationPromises = roles
        .filter((role) => role !== 'owner') // owner is a special role
        .map(async (role) => {
            const orgRole = await RoleDAL.findByRoleNameAndOrganizationId(role, organizationId);
            if (!orgRole) {
                throw new Error(`Role "${role}" does not exist in this organization`);
            }
        });

    await Promise.all(validationPromises);

    // 6. Update the member record directly via Prisma (bypass better-auth)
    const updatedMember = await MemberDAL.updateRoles(member.id, roles.join(', '));

    return updatedMember;
}

/**
 * Get all organizations that are recruiting
 * Public endopoint - no auth required
 */
export async function getRecruitingOrganizations() {
    try {
        const organizations = await OrganizationDAL.findRecruiting();

        return {
            success: true,
            organizations,
        };
    } catch (error) {
        console.error('Error fetching recruiting organizations:', error);
        return {
            success: false,
            organizations: [],
            error: 'Failed to fetch recruiting organizations',
        };
    }
}

export async function updateOrganization(data: {
    organizationId: string;
    name: string;
    slug: string;
    isRecruiting: boolean;
}) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'organization.update',
            resource: 'organization',
            resourceId: data.organizationId,
            errorMessage: 'User not authenticated',
        });
        throw new Error('Not authenticated');
    }

    const hasPermission = await checkPermissions({
        organization: ['update'],
    });

    if (!hasPermission) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.update',
            resource: 'organization',
            resourceId: data.organizationId,
            errorMessage: 'Insufficient permissions to update organization',
        });
        throw new Error('Unauthorized: Insufficient permissions to update organization');
    }

    // Check if slug is unique
    const existingOrg = await prisma.organization.findUnique({
        where: { slug: data.slug },
    });

    if (existingOrg && existingOrg.id !== data.organizationId) {
        await logDenied({
            userId: currentUser.id,
            action: 'organization.update',
            resource: 'organization',
            resourceId: data.organizationId,
            errorMessage: 'Slug already in use',
        });
        throw new Error('Slug is already in use by another organization');
    }

    const updated = await prisma.organization.update({
        where: { id: data.organizationId },
        data: {
            name: data.name,
            slug: data.slug,
            isRecruiting: data.isRecruiting,
        },
    });

    await logSuccess({
        userId: currentUser.id,
        action: 'organization.update',
        resource: 'organization',
        resourceId: data.organizationId,
        changes: {
            name: updated.name,
            slug: updated.slug,
            isRecruiting: updated.isRecruiting,
        },
    });

    console.log('[SERVER] Updated organization isRecruiting to:', updated.isRecruiting);

    return { success: true, organization: updated };
}
