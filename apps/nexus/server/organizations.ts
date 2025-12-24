"use server"

import { prisma } from "@workspace/db";
import { getCurrentUser } from "./users";

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser();

    return (currentUser)
}

export async function getAllOrganizations() {
    const orgs = prisma.organization.findMany();

    return (orgs);
}

export async function getActiveOrganization(userId: string) {
    const memberUser = await prisma.member.findFirst({
        where: {
            userId: userId
        }
    });

    if (!memberUser) {
        return null;
    }

    const activeOrganization = await prisma.organization.findFirst({
        where: {
            id: memberUser.organizationId
        }
    });

    return activeOrganization;
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
    const existingRole = await prisma.organizationRole.findFirst({
        where: {
            id: roleId,
            organizationId: organizationId,
        },
    });

    if (!existingRole) {
        throw new Error('Role not found or does not belong to this organization');
    }

    // Update the role with new permissions
    const updatedRole = await prisma.organizationRole.update({
        where: {
            id: roleId,
        },
        data: {
            permission: JSON.stringify(permission),
        },
    });

    return updatedRole;
}

export async function deleteOrganization(organizationId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        throw new Error('Unauthorized');
    }

    // Verify user is a member of this organization
    const member = await prisma.member.findFirst({
        where: {
            userId: currentUser.id,
            organizationId: organizationId,
        },
    });

    if (!member) {
        throw new Error('You are not a member of this organization');
    }

    // Delete the organization (cascade will handle members, invitations, and roles)
    await prisma.organization.delete({
        where: {
            id: organizationId,
        },
    });

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
    const existingRole = await prisma.organizationRole.findFirst({
        where: {
            id: roleId,
            organizationId: organizationId,
        },
    });

    if (!existingRole) {
        throw new Error('Role not found or does not belong to this organization');
    }

    // Check if any members are using this role
    const membersUsingRole = await prisma.member.findMany({
        where: {
            organizationId: organizationId,
            role: {
                contains: existingRole.role,
            },
        },
    });

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
    await prisma.organizationRole.delete({
        where: {
            id: roleId,
        },
    });

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

    if (!query || query.trim().length < 2) {
        return [];
    }

    const searchTerm = query.trim().toLowerCase();

    const users = await prisma.user.findMany({
        where: {
            OR: [
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { username: { contains: searchTerm, mode: 'insensitive' } },
                { nickname: { contains: searchTerm, mode: 'insensitive' } },
            ],
        },
        take: 10,
        select: {
            id: true,
            email: true,
            username: true,
            nickname: true,
            image: true,
        },
    });

    return users;
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
    const currentUserMember = await prisma.member.findFirst({
        where: {
            userId: currentUser.id,
            organizationId: organizationId,
        },
    });

    if (!currentUserMember) {
        throw new Error('You are not a member of this organization');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new Error('User not found');
    }

    // Check if user is already a member of this organization
    const existingMember = await prisma.member.findFirst({
        where: {
            userId: userId,
            organizationId: organizationId,
        },
    });

    if (existingMember) {
        throw new Error('User is already a member of this organization');
    }

    // Verify the role exists for this organization (if it's not "owner")
    if (role !== 'owner') {
        const orgRole = await prisma.organizationRole.findFirst({
            where: {
                organizationId: organizationId,
                role: role,
            },
        });

        if (!orgRole) {
            throw new Error(`Role "${role}" does not exist in this organization`);
        }
    }

    // Create the member
    const member = await prisma.member.create({
        data: {
            userId: userId,
            organizationId: organizationId,
            role: role,
        },
        include: {
            user: true,
            organization: true,
        },
    });

    return member;
}
