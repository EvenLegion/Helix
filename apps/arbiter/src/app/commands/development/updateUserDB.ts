import type { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";

export const command: CommandData = {
    name: 'import-users',
    description: 'Updates the user database with the latest information."'
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const guild = interaction.guild;

    if (!guild) {
        return interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // const ROLE_ID = '1352350908385853541'; // Legionnaire
    const ROLE_ID = '1378564784370225252'; // @everyone for dev

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

        await interaction.editReply({
            content: "User database has been updated with the latest information.",
        });
    } catch (error) {
        console.log(`Error updating user database: ${error}`);
        await interaction.editReply({
            content: `There was an error updating the user database: ${error}`,
        });
    }
}
