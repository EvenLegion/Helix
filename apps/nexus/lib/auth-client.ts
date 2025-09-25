import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ac, staff, admin, member, owner } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
    plugins: [
        organizationClient({
            ac,
            roles: {
                staff,
                admin,
                member,
                owner
            }
        }),
    ],
    baseURL: process.env.NODE_ENV === 'production'
        ? 'http://localhost:3000'
        : 'http://localhost:3000'
});
