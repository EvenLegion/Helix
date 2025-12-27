import { MiddlewareContext, stopMiddlewares } from 'commandkit';
import { MessageFlags } from 'discord.js';
import { forInteraction } from '@workspace/logger';
import { CONFIG, isDev } from '../../config';

// Only Staff role should be able to run /post-division-message command
const STAFF_ROLE_ID = CONFIG.STAFF_ROLE_ID;

export async function beforeExecute(ctx: MiddlewareContext) {
  const { interaction } = ctx;

  // Dev-mode bypass: allow during local development or explicit override
  if (isDev() || CONFIG.DEV_BYPASS) return;

  if (!interaction.inGuild()) return;

  // Resolve the member to check roles
  let member = interaction.guild?.members.cache.get(interaction.user.id);
  if (!member && interaction.guild) {
    try {
      member = await interaction.guild.members.fetch(interaction.user.id);
    } catch {
      member = null as any;
    }
  }

  const allowed = (member as any)?.roles?.cache?.has?.(STAFF_ROLE_ID);
  if (allowed) return;

  // Not allowed — respond ephemerally and stop further middlewares/handler
  if (interaction.isRepliable()) {
    await interaction.reply({
      content: 'This command is only available to Server Staff.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const log = forInteraction(interaction).child({ mod: 'middleware', group: 'post-division-message' });
  log.warn({ reason: 'insufficient_role' }, 'Blocked /post-division-message due to missing Staff role');
  stopMiddlewares();
}
