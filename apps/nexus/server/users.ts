"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@workspace/db";

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

    const currentUser = await prisma.user.findUnique({
        where: { id: session?.user.id },
        include: {
            Member: {
                include: {
                    organization: true,
                }
            }
        }
    });

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
    }

    const member = await prisma.member.findFirst({
        where: { userId: currentUser?.id },
        include: { organization: true }
    });

    return {
        ...session,
        currentUser,
        member,
    };
}
