"use server";

import { getCurrentUser } from './users';
import { RecruitmentApplicationDAL } from '@/dal/recruitment-application';
import { logSuccess, logDenied, logError } from './audit';

/**
 * Submit a recruitment application
 *
 * Security:
 * - User Must Be Authenticated
 * - Only one pending application per user
 * - All form data is validated via Zod schema in the form component
 *
 * @param data - The recruitment application data
 * @returns The created recruitment application
 * @throws Error if unauthorized or duplicate application
 */
export async function submitRecruitmentApplication(data: {
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
    // Get current user (auth check)
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'recruitment.submit',
            resource: 'recruitment_application',
            errorMessage: 'User not authenticated',
        });
        throw new Error('User not authenticated');
    }

    // Check for existing pending application
    const hasPendingApplcation = await RecruitmentApplicationDAL.hasPendingApplication(
        currentUser.id
    );

    if (hasPendingApplcation) {
        await logDenied({
            userId: currentUser.id,
            action: 'recruitment.submit',
            resource: 'recruitment_application',
            errorMessage: 'User already has a pending application',
            metadata: {
                rsiHandle: data.rsiHandle,
            },
        });
        throw new Error('You already have a pending application. Please wait for it to be reviewed.');
    }

    // Create the recruitment application
    try {
        const application = await RecruitmentApplicationDAL.create({
            userId: currentUser.id,
            rsiHandle: data.rsiHandle,
            age: data.age,
            combatExperience: data.combatExperience,
            logisticsExperience: data.logisticsExperience,
            supportExperience: data.supportExperience,
            starCitizenExperience: data.starCitizenExperience,
            top3ShipsWhy: data.top3ShipsWhy,
            whenStartPlayingSC: data.whenStartPlayingSC,
            whyJoin: data.whyJoin,
            canCommitToDiscord: data.canCommitToDiscord,
        });

        // Log success
        await logSuccess({
            userId: currentUser.id,
            action: 'recruitment.submit',
            resource: 'recruitment_application',
            resourceId: application.id,
            metadata: {
                rsiHandle: data.rsiHandle,
                age: data.age,
                combatExperience: data.combatExperience,
                logisticsExperience: data.logisticsExperience,
                supportExperience: data.supportExperience,
            },
        });

        return {
            success: true,
            applicationId: application.id,
        };
    } catch (error) {
        // Log error
        await logError({
            userId: currentUser.id,
            action: 'recruitment.submit',
            resource: 'recruitment_application',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            metadata: {
                rsiHandle: data.rsiHandle,
            },
        });

        // Rethrow error
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            throw new Error('A database constraint prevented this submission. Please contact support.');
        }

        throw new Error('Failed to submit application. Please try again later.');
    }
}

/**
 * Get all applications for the current user
 * Allows users to view their application history
 *
 * @returns Array of user's recruitment applications
 */
export async function getMyApplications() {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'recruitment.list_own',
            resource: 'recruitment_application',
            errorMessage: 'User not authenticated',
        });
        throw new Error('User not authenticated');
    }

    const applications = await RecruitmentApplicationDAL.findByUserId(currentUser.id);

    await logSuccess({
        userId: currentUser.id,
        action: 'recruitment.list_own',
        resource: 'recruitment_application',
        metadata: {
            count: applications.length,
        },
    });

    return applications;
}

/**
 * Check if current user has a pending recruitment application
 * Used by the form to show warning message
 *
 * @returns Boolean indicating if user has a pending application
 */
export async function checkPendingApplication() {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        return false;
    }

    const hasPending = await RecruitmentApplicationDAL.hasPendingApplication(currentUser.id);

    return hasPending;

}

/**
 * Get a specific application by ID
 * Only owner or admins can view
 *
 * @param id - The ID of the recruitment application
 * @returns The recruitment application or null
 */
export async function getApplcicationById(applicationId: string) {
    const { currentUser } = await getCurrentUser();

    if (!currentUser) {
        await logDenied({
            action: 'recruitment.view',
            resource: 'recruitment_application',
            resourceId: applicationId,
            errorMessage: 'User not authenticated',
        });
        throw new Error('User not authenticated');
    }

    const application = await RecruitmentApplicationDAL.findById(applicationId);

    if (!application) {
        await logDenied({
            userId: currentUser.id,
            action: 'recruitment.view',
            resource: 'recruitment_application',
            resourceId: applicationId,
            errorMessage: 'Application not found',
        });
        throw new Error('Application not found');
    }

    // Security: Only owner or admins can view
    // TODO: Implement needs recruiter view permission check
    if (application.userId !== currentUser.id) {
        await logDenied({
            userId: currentUser.id,
            action: 'recruitment.view',
            resource: 'recruitment_application',
            resourceId: applicationId,
            errorMessage: 'Cannot view other users applications',
            metadata: {
                applicationOwnerId: application.userId,
            },
        });
        throw new Error('You do not have permission to view this application');
    }

    await logSuccess({
        userId: currentUser.id,
        action: 'recruitment.view',
        resource: 'recruitment_application',
        resourceId: applicationId,
    });

    return application;
}
