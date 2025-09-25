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
