"use server"

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const isAdmin = async () => {
    try {
        const { success, error } = await auth.api.hasPermission({
            headers: await headers(),
            body: {
                permissions: {
                    admin: ['admin_dashboard']
                }
            }
        });

        if (error) {
            return {
                success: false,
                error: error || 'Failed to check permissions'
            }
        }

        return success;
    } catch (error) {
        console.error('Error checking admin permissions:', error);
        return {
            success: false,
            error: error || 'An unexpected error occurred while checking permissions'
        };
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
