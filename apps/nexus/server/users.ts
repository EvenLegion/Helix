"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserDAL } from "@/dal/users";
import { MemberDAL } from "@/dal/members";

export const getCurrentUser = async () => {

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        // No session, redirect to Discord OAuth
        const signInResponse = await auth.api.signInSocial({
            body: {
                provider: "discord",
                callbackURL: "/admin"
            },
        });

        if (signInResponse?.url) {
            redirect(signInResponse.url);
        }
    }

    const currentUser = await UserDAL.findByIdWithMemberships(session?.user.id!);

    if (!currentUser) {
        // No session, redirect to Discord OAuth
        const signInResponse = await auth.api.signInSocial({
            body: {
                provider: "discord",
                callbackURL: "/admin"
            },
        });

        if (signInResponse?.url) {
            redirect(signInResponse.url);
        }
        throw new Error('User not found');
    }

    const member = await MemberDAL.findByUserId(currentUser.id);

    return {
        ...session,
        currentUser,
        member,
    };
}
