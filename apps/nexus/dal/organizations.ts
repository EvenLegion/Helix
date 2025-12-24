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
}
