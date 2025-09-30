import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";
import { ac, owner } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
    plugins: [
        organizationClient({
            ac,
            roles: {
                owner,
            },
            dynamicAccessControl: {
                enabled: true,
            },
        }),
        adminClient()
    ],
    baseURL: process.env.NODE_ENV === 'production'
        ? 'http://localhost:3000'
        : 'http://localhost:3000'
});
