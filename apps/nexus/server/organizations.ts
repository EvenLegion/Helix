"use server"

import { prisma } from "@workspace/db";
import { getCurrentUser } from "./users";
import { OrganizationDAL } from "@/dal/organizations";
import { MemberDAL } from "@/dal/members";
import { RoleDAL } from "@/dal/roles";
import { UserDAL } from "@/dal/users";

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser();

    return (currentUser)
}

export async function getAllOrganizations() {
    return OrganizationDAL.findAll();
}

export async function getActiveOrganization(userId: string) {
    const memberUser = await MemberDAL.findByUserId(userId);

    if (!memberUser) {
        return null;
    }

    return OrganizationDAL.findById(memberUser.organizationId);
}

export async function updateOrganizationRole(
    roleId: string,
    organizationId: string,
    permission: Record<string, string[]>
) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Verify the role belongs to the organization
    const existingRole = await RoleDAL.findByIdAndOrganizationId(roleId, organizationId);

    if (!existingRole) {
        throw new Error('Role not found or does not belong to this organization');
    }

    // Update the role with new permissions
    return RoleDAL.updatePermissions(roleId, permission);
}

export async function deleteOrganization(organizationId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Verify user is a member of this organization
    const member = await MemberDAL.findByUserIdAndOrganizationId(
        currentUser.id,
        organizationId
    );

    if (!member) {
        throw new Error('You are not a member of this organization');
    }

    // Delete the organization (cascade will handle members, invitations, and roles)
    await OrganizationDAL.delete(organizationId);

    return { success: true };
}

export async function deleteOrganizationRole(
    roleId: string,
    organizationId: string
) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Verify the role belongs to the organization
    const existingRole = await RoleDAL.findByIdAndOrganizationId(roleId, organizationId);

    if (!existingRole) {
        throw new Error('Role not found or does not belong to this organization');
    }

    // Check if any members are using this role
    const membersUsingRole = await MemberDAL.findByOrganizationIdWithRole(
        organizationId,
        existingRole.role
    );

    // Filter to only members that actually have this role (since role is comma-separated)
    const membersWithRole = membersUsingRole.filter(member => {
        const memberRoles = member.role.split(',').map(r => r.trim());
        return memberRoles.includes(existingRole.role);
    });

    if (membersWithRole.length > 0) {
        throw new Error(
            `Cannot delete role "${existingRole.role}" because it is assigned to ${membersWithRole.length} member(s). Please remove the role from all members first.`
        );
    }

    // Delete the role
    await RoleDAL.delete(roleId);

    return { success: true };
}

/**
 * Search for users by email or username
 */
export async function searchUsers(query: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    return UserDAL.search(query);
}

/**
 * Add a user to an organization
 */
export async function addUserToOrganization(
    userId: string,
    organizationId: string,
    role: string
) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Verify current user is a member of the organization
    const currentUserMember = await MemberDAL.findByUserIdAndOrganizationId(
        currentUser.id,
        organizationId
    );

    if (!currentUserMember) {
        throw new Error('You are not a member of this organization');
    }

    // Check if user exists
    const user = await UserDAL.findById(userId);

    if (!user) {
        throw new Error('User not found');
    }

    // Check if user is already a member of this organization
    const existingMember = await MemberDAL.findByUserIdAndOrganizationId(
        userId,
        organizationId
    );

    if (existingMember) {
        throw new Error('User is already a member of this organization');
    }

    // Verify the role exists for this organization (if it's not "owner")
    if (role !== 'owner') {
        const orgRole = await RoleDAL.findByRoleNameAndOrganizationId(role, organizationId);

        if (!orgRole) {
            throw new Error(`Role "${role}" does not exist in this organization`);
        }
    }

    // Create the member
    const member = await MemberDAL.create({
        userId,
        organizationId,
        role,
    });

    return member;
}

export async function deleteMemberFromOrganization(memberId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Find the member to be removed
    const memberToRemove = await MemberDAL.findById(memberId);

    if (!memberToRemove) {
        throw new Error('Member not found');
    }

    // Verify the member belongs to the organization
    const currentUserMember = await MemberDAL.findByUserIdAndOrganizationId(
        currentUser.id,
        memberToRemove.organizationId
    );

    if (!currentUserMember) {
        throw new Error('You are not a member of this organization');
    }

    // Prevent users from removing themselves
    if (currentUserMember.userId === memberToRemove.userId) {
        throw new Error('You cannot remove yourself from the organization');
    }

    // Prevent from removing the owner
    if (memberToRemove.role === 'owner') {
        throw new Error('You cannot remove the owner from the organization');
    }

    // Delete the member
    await MemberDAL.delete(memberId);

    return { success: true };
}

/**
 * Allow owners to assign themselves additional roles
 * Bypasses better-auth's self-modification restriction
 * SECURITY: Only owners can use this, and owner role cannot be removed
 */
export async function updateSelfMemberRole(
    organizationId: string,
    roles: string[]
) {
    // 1. Get current user
    const { currentUser } = await getCurrentUser();
    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // 2. Find the member record for the current user
    const member = await MemberDAL.findByUserIdAndOrganizationId(
        currentUser.id,
        organizationId
    );

    if (!member) {
        throw new Error('You are not a member of this organization');
    }

    // 3. CRITICAL VALIDATION: Check if user is currently an owner
    const currentRoles = member.role.split(',').map(r => r.trim());
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
        .filter(role => role !== 'owner') // owner is a special role
        .map(async (role) => {
            const orgRole = await RoleDAL.findByRoleNameAndOrganizationId(
                role,
                organizationId
            );
            if (!orgRole) {
                throw new Error(`Role "${role}" does not exist in this organization`);
            }
        });

    await Promise.all(validationPromises);

    // 6. Update the member record directly via Prisma (bypass better-auth)
    const updatedMember = await MemberDAL.updateRoles(
        member.id,
        roles.join(', ')
    );

    return updatedMember;
}

