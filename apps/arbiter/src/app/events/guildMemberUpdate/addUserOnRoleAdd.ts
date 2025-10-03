import { GuildMember } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";

// Target role that triggers user upsert when added
import { CONFIG } from "../../config";
const TARGET_ROLE_ID = CONFIG.LEGIONNAIRE_ROLE_ID;

export default async function (oldMember: GuildMember | any, newMember: GuildMember) {
    const log = childLogger({ mod: 'guildMemberUpdate', event: 'roleAdd', guildId: newMember.guild.id, userId: newMember.user.id });
    try {
        // Ensure we have role sets to compare
        const oldRoles = new Set<string>(oldMember?.roles?.cache?.keys?.() ? Array.from(oldMember.roles.cache.keys()) : []);
        const newRoles = new Set<string>(newMember.roles.cache ? Array.from(newMember.roles.cache.keys()) : []);

        const hadRole = oldRoles.has(TARGET_ROLE_ID);
        const hasRole = newRoles.has(TARGET_ROLE_ID);

        // Only act when the role is newly added
        if (hasRole && !hadRole) {
            const user = newMember.user;
            const profile = {
                id: user.id,
                username: user.username ?? null,
                nickname: newMember.nickname ?? null,
                name: newMember.displayName ?? null,
                image: user.displayAvatarURL ? user.displayAvatarURL() : null,
            } as const;

            await prisma.user.upsert({
                where: { id: profile.id },
                update: {
                    username: profile.username ?? undefined,
                    nickname: profile.nickname ?? undefined,
                    name: profile.name ?? undefined,
                    image: profile.image ?? undefined,
                },
                create: {
                    id: profile.id,
                    username: profile.username,
                    nickname: profile.nickname,
                    name: profile.name,
                    image: profile.image,
                },
            });
        }
    } catch (err) {
        log.error({ err }, "Failed to upsert user on role add");
    }
}
