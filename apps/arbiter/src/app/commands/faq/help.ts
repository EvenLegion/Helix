import { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags, EmbedBuilder } from "discord.js";
import { ensureGuild, replyGuildRequired } from "../../utils/interactions";

export const command: CommandData = {
    name: 'help',
    description: 'Provides a list of available commands and their descriptions',
    options: [
        {
            name: 'category',
            description: 'Select a specific bot category to view commands',
            type: 3, // STRING type
            required: false,
            choices: [
                { name: 'Arbiter', value: 'arbiter' },
                { name: 'Arcane', value: 'arcane' },
                { name: 'Francis', value: 'francis' },
                { name: 'Statbot', value: 'statbot' },
                { name: 'All', value: 'all' }
            ]
        }
    ]
}

export async function chatInput({ interaction }: ChatInputCommandContext) {
    const user = interaction.user;

    // Get the input from the user
    const category = interaction.options.getString('category') || 'all';

    try { ensureGuild(interaction); } catch { return replyGuildRequired(interaction); }

    const arbiter = "> \n> **Arbiter**\n> \n```/name-change-request ```Request to change your Discord server name. This request will be routed to server staff and addressed asap. Use this option if you need to update your division tag.\n\n```/fleetyard ```Pulls the latest information for Fleetyard and how to join the Even Legion Fleet.\n\n```/uniform```An embed with information about the Legion uniform and a link to the channel with more information.\n\n```/redkey```Guide to the supervisor keycard for the Executive Hangars.\n\n```/checkmate```Displays a map and information about the Checkmate Station Contested Zone in Pyro.\n\n```/ruin```Displays a map and information about the Ruin Station Contested Zone in Pyro.\n\n```/orbituary```Displays a map and information about the Orbituary Station Contested Zone in Pyro.\n\n";
    const francis = "> \n> **Legion Manager Francis**\n> \n\n```/achievements```Display the list of user achievements with their progress.\n\n```/coins ```Get the coins amount of anyone in the server\n\n```/richest```Get the richest player in the server.\n\n```/voice-owner```Check ownership of a temporary voice channel.\n\n```/voice-rename ```Rename a temporary voice channel.\n\n```/voice-transfer ```Transfer ownership of a temporary voice channel.\n\n```/voice-claim ```Claim ownership of a temporary voice channel.\n\n";
    const statbot = "> \n> **Statbot**\n> \n\n```/stats user```See an overview of a user’s stats.\n\n```/stats voice```See an overview of the server’s voice stats. \n\n```/stats channel```See an overview of a channel’s stats.";
    const arcane = "> \n> **Arcane**\n> \n\n```/rank```View your or another member’s level and xp progress.\n\n```/card```Manage your rank card settings.\n\n";

    let description = '';

    switch (category) {
        case 'arbiter':
            description = arbiter;
            break;
        case 'francis':
            description = francis;
            break;
        case 'statbot':
            description = statbot;
            break;
        case 'arcane':
            description = arcane;
            break;
        case 'all':
        default:
            description = arbiter + arcane + francis + statbot
            break;
    }

    const embed = new EmbedBuilder()
        .setTitle("Legion Bot Commands")
        .setDescription(`Hello <@${user.id}>, here is a list of available commands and their descriptions:\n\n${description}`)
        .setColor("#e51515")
        .setFooter({
            text: "Even Legion",
        });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
