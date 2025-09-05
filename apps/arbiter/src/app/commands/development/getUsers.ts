import type {CommandData, ChatInputCommandContext} from "commandkit";
import { MessageFlags, AttachmentBuilder } from "discord.js";
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const command: CommandData = {
    name: 'get-users',
    description: 'Fetches all users in the server'
};

export async function chatInput({ interaction }: ChatInputCommandContext ) {

    const guild = interaction.guild;

    if(!guild) {
        return interaction.reply({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const ROLE_ID = '1352350908385853541';

    const selectedRole = [
        '1356438908212088863',
        '1356438093988757686',
        '1356438285592825989',
        '1362489356958437477',
        '1356438213438472323',
        '1356458993056485477',
        '1356459074392162414',
        '1356459107955118110',
        '1356459145762574516',
        '1356459183548923965'
    ]

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    await guild.members.fetch();

    const filteredMembers = guild.members.cache
        .filter(member => member.roles.cache.has(ROLE_ID))
        .map(member => ({
            username: member.user.username,
            nickname: member.nickname || 'No Nickname',
            roles: member.roles.cache
                .filter(role => selectedRole.includes(role.id))
                .map(role => role.name)
                .join('-'),
            id: member.user.id
        }));

    const csvHeader = 'Username,Nickname,Roles,ID';
    const csvRows = filteredMembers.map(m =>
        `"${m.username}","${m.nickname}","${m.roles}","${m.id}"`);

    const csvContent = [csvHeader, ...csvRows].join(os.EOL);

    // Write to a temp file
    const filePath = path.join(os.tmpdir(), `users-${Date.now()}.csv`);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    const attachment = new AttachmentBuilder(filePath).setName('filtered_users.csv');

    await interaction.editReply({
        content: `Fetched ${filteredMembers.length} users with the specified role.`,
        files: [attachment],
    });

    setTimeout(() => fs.unlinkSync(filePath), 10000);

}
