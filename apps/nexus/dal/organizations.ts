import { prisma } from "@workspace/db";
import type { Organization } from "@workspace/db";

export class OrganizationDAL {
    /**
     * Find an organization by ID
     */
    static async findById(id: string) {
        return prisma.organization.findFirst({
            where: { id },
        });
    }

    /**
     * Find all organizations
     */
    static async findAll() {
        return prisma.organization.findMany();
    }

    /**
     * Delete an organization by ID
     */
    static async delete(id: string) {
        return prisma.organization.delete({
            where: { id },
        });
    }

    /**
     * Find all organizations that are currently recruiting
     */
    static async findRecruiting() {
        return prisma.organization.findMany({
            where: { isRecruiting: true },
            select: {
                id: true,
                name: true,
                slug: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    /**
     * Check if an organization is recruiting
     */
    static async isRecruiting(organizationId: string): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { isRecruiting: true },
        });
        return org?.isRecruiting ?? false;
    }

    /**
     * Set an organization's recruiting status
     * @param organizationId - The ID of the organization
     * @param isRecruiting - The recruiting status to set
     */
    static async setRecruitingStatus(organizationId: string, isRecruiting: boolean): Promise<Organization> {
        return prisma.organization.update({
            where: { id: organizationId },
            data: { isRecruiting },
        });
    }
}

