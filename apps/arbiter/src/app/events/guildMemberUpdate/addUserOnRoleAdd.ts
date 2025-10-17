import { GuildMember } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";
import { ensureDiscordUser } from "../../utils/ensureUsers";

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
            await ensureDiscordUser(newMember, "roleAdd");
        }
    } catch (err) {
        log.error({ err }, "Failed to upsert user on role add");
    }
}
