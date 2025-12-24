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
