"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Component that refreshes the session on mount to ensure permissions are up-to-date
 * This ensures that when permissions change (e.g., roles are updated), they take effect
 * on page refresh without requiring a full logout/login
 *
 * With dynamicAccessControl enabled, better-auth checks permissions dynamically from the database.
 * By calling router.refresh(), we force Next.js to re-fetch server components and re-run
 * server actions, which will cause better-auth to recalculate permissions from the database.
 */
export function SessionRefresh() {
    const router = useRouter();

    useEffect(() => {
        // Refresh the router on mount to force server-side revalidation
        // This ensures permissions are recalculated from the database
        // The dynamicAccessControl feature will check permissions dynamically on each request
        router.refresh();
    }, [router]); // Only run on mount

    return null; // This component doesn't render anything
}

