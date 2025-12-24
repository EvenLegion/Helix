import { prisma } from "@workspace/db";
import type { User, Account } from "@workspace/db";

export class UserDAL {
    /**
     * Find a user by ID with their memberships
     */
    static async findByIdWithMemberships(id: string) {
        return prisma.user.findUnique({
            where: { id },
            include: {
                Member: {
                    include: {
                        organization: true,
                    }
                }
            }
        });
    }

    /**
     * Find a user by ID
     */
    static async findById(id: string) {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    /**
     * Find a user by ID with accounts (for auth)
     */
    static async findByIdWithAccounts(id: string) {
        return prisma.user.findUnique({
            where: { id },
            include: { accounts: true }
        });
    }

    /**
     * Search users by email, username, or nickname
     */
    static async search(query: string, limit: number = 10) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const searchTerm = query.trim().toLowerCase();

        return prisma.user.findMany({
            where: {
                OR: [
                    { email: { contains: searchTerm, mode: 'insensitive' } },
                    { username: { contains: searchTerm, mode: 'insensitive' } },
                    { nickname: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            take: limit,
            select: {
                id: true,
                email: true,
                username: true,
                nickname: true,
                image: true,
            },
        });
    }

    /**
     * Create a new user
     */
    static async create(data: {
        id: string;
        username: string;
        name: string;
        email: string;
        image: string | null;
        emailVerified: boolean;
    }) {
        return prisma.user.create({
            data,
        });
    }

    /**
     * Update user data
     */
    static async update(id: string, data: {
        username?: string;
        name?: string;
        email?: string;
        image?: string | null;
        emailVerified?: boolean;
        nickname?: string;
    }) {
        return prisma.user.update({
            where: { id },
            data,
        });
    }
}
