import { prisma } from "@workspace/db";
import type { OrganizationRole } from "@workspace/db";

export class RoleDAL {
    /**
     * Find a role by ID
     */
    static async findById(id: string) {
        return prisma.organizationRole.findFirst({
            where: { id },
        });
    }

    /**
     * Find a role by ID and organization ID
     */
    static async findByIdAndOrganizationId(roleId: string, organizationId: string) {
        return prisma.organizationRole.findFirst({
            where: {
                id: roleId,
                organizationId: organizationId,
            },
        });
    }

    /**
     * Find a role by name and organization ID
     */
    static async findByRoleNameAndOrganizationId(role: string, organizationId: string) {
        return prisma.organizationRole.findFirst({
            where: {
                organizationId: organizationId,
                role: role,
            },
        });
    }

    /**
     * Find all roles for given organization IDs
     */
    static async findByOrganizationIds(organizationIds: string[]) {
        return prisma.organizationRole.findMany({
            where: {
                organizationId: {
                    in: organizationIds,
                },
            },
        });
    }

    /**
     * Create a new role
     */
    static async create(data: {
        organizationId: string;
        role: string;
        permission: string;
    }) {
        return prisma.organizationRole.create({
            data,
        });
    }

    /**
     * Update role permissions
     */
    static async updatePermissions(roleId: string, permission: Record<string, string[]>) {
        return prisma.organizationRole.update({
            where: {
                id: roleId,
            },
            data: {
                permission: JSON.stringify(permission),
            },
        });
    }

    /**
     * Delete a role by ID
     */
    static async delete(roleId: string) {
        return prisma.organizationRole.delete({
            where: {
                id: roleId,
            },
        });
    }
}
