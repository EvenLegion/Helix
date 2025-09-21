import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    plugins: [
        organizationClient()
    ],
    baseURL: process.env.NODE_ENV === 'production'
        ? 'http://localhost:3000'
        : 'http://localhost:3000'
});
