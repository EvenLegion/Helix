import { prisma } from "@workspace/db";

type MinimalClient = { users: { fetch: (id: string) => Promise<{ username?: string } | any> } };
type MinimalGuild = { members: { fetch: (id: string) => Promise<{ nickname?: string | null; displayName?: string; user?: { username?: string } }> } };

/** Resolve a user's best display name using DB, then guild, then global user fetch. */
export async function resolveDisplayName(params: {
    client: MinimalClient;
    guild?: MinimalGuild | null;
    userId: string;
    fallbackUsername?: string;
}): Promise<string> {
    const { client, guild, userId, fallbackUsername } = params;

    // 1) DB user row
    try {
        const u = await prisma.user.findUnique({
            where: { id: userId },
            select: { nickname: true, preferredName: true, username: true },
        });
        if (u) {
            const name = (u.nickname || u.preferredName || u.username || "").trim();
            if (name) return name;
        }
    } catch {
        // ignore
    }

    // 2) Guild member (nickname/display)
    if (guild) {
        try {
            const m = await guild.members.fetch(userId);
            const name = (m.nickname || (m as any).displayName || m.user?.username || "").toString().trim();
            if (name) return name;
        } catch {
            // ignore
        }
    }

    // 3) Global user fetch
    try {
        const u = await client.users.fetch(userId);
        if (u?.username) return u.username;
    } catch {
        // ignore
    }

    return fallbackUsername || userId;
}

/** Resolve names for many user IDs using DB first, then guild members, then global user fetch. */
export async function resolveUserNameMap(params: {
    client: MinimalClient;
    guild?: MinimalGuild | null;
    userIds: string[];
}): Promise<Map<string, string>> {
    const { client, guild } = params;
    const ids: string[] = Array.from(new Set(params.userIds.filter((v): v is string => typeof v === "string" && v.length > 0)));
    const map = new Map<string, string>();

    if (!ids.length) return map;

    // 1) DB lookup
    try {
        const dbUsers = await prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, nickname: true, preferredName: true, username: true },
        });
        for (const u of dbUsers) {
            const name = (u.nickname || u.preferredName || u.username || u.id).trim();
            map.set(u.id, name);
        }
    } catch {
        // ignore
    }

    // 2) Guild members (fetch individually to avoid unsupported batch param shapes)
    const unresolvedAfterDb = ids.filter(id => !map.has(id));
    if (unresolvedAfterDb.length && guild) {
        const results = await Promise.allSettled(unresolvedAfterDb.map(id => guild.members.fetch(id)));
        results.forEach((res, idx) => {
            const id: string = unresolvedAfterDb[idx]!;
            if (res.status === "fulfilled") {
                const m = res.value;
                const name = (m.nickname || (m as any).displayName || m.user?.username || id).toString();
                map.set(id, name);
            }
        });
    }

    // 3) Global user fetch
    const stillUnresolved = ids.filter(id => !map.has(id));
    if (stillUnresolved.length) {
        const results = await Promise.allSettled(stillUnresolved.map(id => client.users.fetch(id)));
        results.forEach((res, idx) => {
            const id: string = stillUnresolved[idx]!;
            if (res.status === "fulfilled") {
                const u = res.value;
                const uname = u?.username || id;
                map.set(id, uname);
            } else {
                map.set(id, id);
            }
        });
    }

    return map;
}
