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
