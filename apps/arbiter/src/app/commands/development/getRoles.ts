import type { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags, AttachmentBuilder } from "discord.js";
import { prisma } from "@workspace/db";

export const command: CommandData = {
    name: 'get-roles',
    description: 'Fetches all the roles in the server'
};

export async function chatInput({ interaction }: ChatInputCommandContext) {

    const guild = interaction.guild;

    if (!guild) {
        return interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Fetch all roles in the guild
        await guild.roles.fetch();

        const roles = guild.roles.cache
            .filter(role => role.name !== '@everyone') // Exclude @everyone role
            .sort((a, b) => b.position - a.position) // Sort by position descending
            .map(role => ({
                name: role.name,
                roleId: role.id,
                color: role.hexColor,
                position: role.position,
                permissions: role.permissions.toArray().join(', '),
                hoist: role.hoist,
                memberCount: role.members.size,
            }));

        // Writing to database
        // Clear existing roles
        await prisma.discordRoles.deleteMany();

        const createdRoles = await prisma.discordRoles.createMany({
            data: roles,
        });

        await interaction.editReply({
            content: `Successfully saved ${createdRoles.count} to the database`
        })
    } catch (error) {
        console.error('Error fetching roles:', error);
        await interaction.editReply({
            content: 'There was an error fetching the roles. Please try again later.',
        });
    }
}
