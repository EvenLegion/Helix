"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@workspace/db";

export const getCurrentUser = async () => {

    const session = await auth.api.getSession({
        headers: await headers(),
    });




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
