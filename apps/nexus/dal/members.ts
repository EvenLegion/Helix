import { prisma } from "@workspace/db";
import type { Member, User, Organization, OrganizationRole } from "@workspace/db";

export class MemberDAL {
    /**
     * Find a member by user ID
     */
    static async findByUserId(userId: string) {
        return prisma.member.findFirst({
            where: { userId },
            include: { organization: true }
        });
    }

    /**
     * Find a member by user ID and organization ID
     */
    static async findByUserIdAndOrganizationId(userId: string, organizationId: string) {
        return prisma.member.findFirst({
            where: {
                userId,
                organizationId,
            },
        });
    }

    /**
     * Find all members for given organization IDs
     */
    static async findByOrganizationIds(organizationIds: string[]) {
        return prisma.member.findMany({
            where: {
                organizationId: {
                    in: organizationIds,
                },
            },
            include: {
                user: true,
                organization: {
                    include: {
                        OrganizationRole: true,
                    },
                },
            },
        });
    }

    /**
     * Find members using a specific role in an organization
     */
    static async findByOrganizationIdWithRole(organizationId: string, roleName: string) {
        return prisma.member.findMany({
            where: {
                organizationId: organizationId,
                role: {
                    contains: roleName,
                },
            },
        });
    }

    /**
     * Create a new member
     */
    static async create(data: {
        userId: string;
        organizationId: string;
        role: string;
    }) {
        return prisma.member.create({
            data,
            include: {
                user: true,
                organization: true,
            },
        });
    }

    /**
     * Check if a member exists for user and organization
     */
    static async exists(userId: string, organizationId: string): Promise<boolean> {
        const member = await prisma.member.findFirst({
            where: {
                userId,
                organizationId,
            },
        });
        return !!member;
    }

    /**
     * Delete a member
     */
    static async delete(memberId: string) {
        return prisma.member.delete({
            where: { id: memberId },
        });
    }

    /**
     * Find a member by ID
     */
    static async findById(memberId: string) {
        return prisma.member.findUnique({
            where: { id: memberId },
            include: {
                user: true,
                organization: true,
            },
        });
    }

    /**
     * Update a member's roles directly (bypasses better-auth)
     * Used for owner self-assignment only
     */
    static async updateRoles(memberId: string, roles: string) {
        return prisma.member.update({
            where: { id: memberId },
            data: { role: roles },
            include: {
                user: true,
                organization: true,
            },
        });
    }
}
