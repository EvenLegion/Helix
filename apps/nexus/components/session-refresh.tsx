"use client";

import { useEffect, useRef } from "react";
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
    const hasRefreshed = useRef(false);

    useEffect(() => {
        // Only refresh once on mount to prevent redirect loops
        if (!hasRefreshed.current) {
            hasRefreshed.current = true;
            // Use a small delay to avoid conflicts with initial page load
            const timeoutId = setTimeout(() => {
                router.refresh();
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [router]);

    return null; // This component doesn't render anything
}

