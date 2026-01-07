import { prisma } from '@workspace/db';
import type { RecruitmentApplication } from '@workspace/db';

/**
 * Data Access Layer for Recruitment Applications
 * Handles database operations related to recruitment applications.
 * Follows the Data Access Layer (DAL) pattern.
 */
export class RecruitmentApplicationDAL {
    /**
     * Create a new recruitment application
     * @param data - The recruitment application data
     * @returns The created recruitment application with user relation
     */
    static async create(data: {
        userId: string;
        rsiHandle: string;
        age: number;
        combatExperience: number;
        logisticsExperience: number;
        supportExperience: number;
        starCitizenExperience: string;
        top3ShipsWhy: string;
        whenStartPlayingSC: string;
        whyJoin: string;
        canCommitToDiscord: boolean;
    }) {
        return prisma.recruitmentApplication.create({
            data,
            include: {
                user: true,
            },
        });
    }

    /**
     * Find all applications for a specific user
     * @param userId - The ID of the user
     * @returns An array of recruitment applications for the user
     */
    static async findByUserId(userId: string) {
        return prisma.recruitmentApplication.findMany({
            where: { userId },
            orderBy: { appliedAt: 'desc' },
            include: {
                user: true,
            },
        });
    }

    /**
     * Find pending application for user
     * Used to check for duplicates before submission
     * @param userId - The ID of the user
     * @returns The pending recruitment application or null
     */
    static async findPendingByUserId(userId: string) {
        return prisma.recruitmentApplication.findFirst({
            where: {
                userId,
                status: 'pending'
            },
            include: {
                user: true,
            },
        });
    }

    /**
     * Find a recruitment application by ID
     * @param id - The ID of the recruitment application
     * @returns The recruitment application or null
     */
    static async findById(id: string): Promise<RecruitmentApplication | null> {
        return prisma.recruitmentApplication.findUnique({
            where: { id },
            include: {
                user: true,
            },
        });
    }

    /**
     * Find all applications with optional filtering
     * @param filters - Optional filter criteria
     * @returns An array of recruitment applications
     */
    static async findAll(filters?: {
        status?: string,
        fromDate?: Date,
        toDate?: Date,
    }) {
        return prisma.recruitmentApplication.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
                ...(filters?.fromDate && {
                    appliedAt: { gte: filters.fromDate },
                }),
                ...(filters?.toDate && {
                    appliedAt: { lte: filters.toDate },
                }),
            },
            orderBy: { appliedAt: 'desc' },
            include: {
                user: true,
            },
        });
    }

    /**
     * Update the status of a recruitment application
     * @param id - The ID of the recruitment application
     * @param status - The new status
     * @param reviewedBy - The ID of the reviewer
     * @returns The updated recruitment application
     */
    static async updateStatus(
        id: string,
        status: 'accepted' | 'rejected',
        reviewedBy: string
    ){
        return prisma.recruitmentApplication.update({
            where: { id },
            data: {
                status,
                reviewedBy,
                reviewedAt: new Date(),
            },
            include: {
                user: true,
            },
        });
    }

    /**
     * Check if user has a pending application
     * Quick boolean check without return the full object
     * @param userId - The ID of the user
     * @returns True if user has a pending application, false otherwise
     */
    static async hasPendingApplication(userId: string): Promise<boolean> {
        const count = await prisma.recruitmentApplication.count({
            where: {
                userId,
                status: 'pending'
            }
        });
        return count > 0;
    }

    /**
     * Delete a recruitment application by ID
     * @param id - The ID of the recruitment application
     * @returns The deleted recruitment application
     */
    static async delete(id: string) {
        return prisma.recruitmentApplication.delete({
            where: { id },
        });
    }

    /**
     * Count applications by status
     * Useful for dashboard statistics
     * @returns Object with counts per status
     */
    static async countByStatus() {
        const [pending, accepted, rejected] = await Promise.all([
            prisma.recruitmentApplication.count({ where: { status: 'pending' } }),
            prisma.recruitmentApplication.count({ where: { status: 'accepted' } }),
            prisma.recruitmentApplication.count({ where: { status: 'rejected' } }),
        ]);

        return { pending, accepted, rejected };
    }
}
