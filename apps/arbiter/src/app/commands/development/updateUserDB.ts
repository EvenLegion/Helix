import type { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";
import { CONFIG } from "../../config";
import { ensureGuild, replyGuildRequired } from "../../utils/interactions";

export const command: CommandData = {
    name: 'import-users',
    description: 'Updates the user database with the latest information."'
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const log = forInteraction(interaction).child({ mod: 'dev', cmd: 'import-users' });
    try { ensureGuild(interaction); } catch { return replyGuildRequired(interaction); }
    const guild = interaction.guild!;

    // Configure via env: defaults to everyone in dev, else specific role
    const ROLE_ID = process.env.IMPORT_USERS_ROLE_ID ?? CONFIG.STAFF_ROLE_ID;

    await guild.members.fetch();

    const filteredMembers = guild.members.cache
        .filter(member => member.roles.cache.has(ROLE_ID))
        .map(member => ({
            userId: member.user.id,
            guildId: member.guild.id,
            username: member.user.username,
            nickname: member.nickname || null,
            roles: member.roles.cache,
        }));

    //console.log(filteredMembers)

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });


    try {
        for (const member of filteredMembers) {

            await prisma.user.upsert({
                where: {
                    id: member.userId,
                },
                update: {
                    username: member.username,
                    nickname: member.nickname || ' ',
                },
                create: {
                    id: member.userId,
                    username: member.username,
                    nickname: member.nickname || ' ',
                    email: ' ',
                    emailVerified: false,
                    name: ' ',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            })
        }

        await interaction.editReply({ content: "User database has been updated with the latest information." });
    } catch (error) {
        log.error({ err: error }, 'Error updating user database');
        await interaction.editReply({ content: "There was an error updating the user database." });
    }
}
