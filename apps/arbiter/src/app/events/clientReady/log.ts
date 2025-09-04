import type { EventHandler } from 'commandkit';
import { Logger } from 'commandkit/logger';
import { ActivityType } from 'discord.js';

const handler: EventHandler<'clientReady'> = async (client) => {
  Logger.info(`Logged in as ${client.user.username}!`);

  client.user.setPresence({
      activities: [{
          name: 'the Legion',
          type: ActivityType.Watching
      }],
      status: 'online',
  })
};

export default handler;
