import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, owner } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
    plugins: [
        organizationClient({
            ac,
            roles: {
                owner
            },
            dynamicAccessControl: {
                enabled: true,
            }
        }),
    ],
    baseURL: process.env.NODE_ENV === 'production'
        ? 'http://localhost:3000'
        : 'http://localhost:3000'
});
