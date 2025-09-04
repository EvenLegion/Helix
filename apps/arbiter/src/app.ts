import { Client } from 'discord.js';

const client = new Client({
  intents: [
      'Guilds',
      'GuildMembers',
      'GuildMessages',
      'MessageContent',
      'GuildMessageReactions'
  ],
});

export default client;


// TODO: Import Name commands and then the guildMemberAdd event
// TODO: Look into making roles and channels dynamic