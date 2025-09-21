"use server"

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@workspace/db";
import { getCurrentUser } from "./users";

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser();

    return (currentUser)
}
// TODO: Refactor to use prisma include features to not have to do a multistep query
