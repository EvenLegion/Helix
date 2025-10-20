import { prisma } from "@workspace/db";

export const GET = async () => {

    // Get first user from DB
    const users = await prisma.user.findFirst();

    return new Response(JSON.stringify(users), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}