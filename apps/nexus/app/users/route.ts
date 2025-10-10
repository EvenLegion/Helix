import { prisma } from "@workspace/db";

export const GET = async () => {
    try {
        const user = await prisma.user.findFirst();
        return new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (_err) {
        return new Response(JSON.stringify({ error: "Failed to fetch user" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}