"use server"

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Check if the current user is a site admin (via admin plugin)
 * @returns Promise that resolves to true if user has admin role, false otherwise
 */
export const isAdmin = async (): Promise<boolean> => {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return false;
        }

        // Check if user has admin role via the admin plugin
        // The admin plugin stores role in user.role field
        const userRole = (session.user as any).role;

        return userRole === 'admin';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Check if the current user has specific permissions
 * @param permissions Object with category and permission arrays, e.g., { admin: ['admin_dashboard'] }
 * @returns Promise that resolves to true if user has the permissions, false otherwise
 */
export async function checkPermissions(permissions: Record<string, string[]>): Promise<boolean> {
    try {
        const { success, error } = await auth.api.hasPermission({
            headers: await headers(),
            body: {
                permissions
            }
        });

        if (error) {
            console.error('Error checking permissions:', error);
            return false;
        }

        return success ?? false;
    } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
}

/**
 * Check if the current user has specific permissions OR is a site admin
 * Site admins bypass organization-level permission checks
 * @param permissions Object with category and permission arrays
 * @returns Promise that resolves to true if user is admin or has the permissions
 */
export async function checkPermissionsOrAdmin(permissions: Record<string, string[]>): Promise<boolean> {
    // First check if user is a site admin
    const adminStatus = await isAdmin();
    if (adminStatus) {
        return true;
    }

    // If not admin, check specific permissions
    return checkPermissions(permissions);
}
