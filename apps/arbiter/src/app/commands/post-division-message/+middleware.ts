import { MiddlewareContext, stopMiddlewares } from 'commandkit';
import { MessageFlags, PermissionsBitField } from 'discord.js';
import { forInteraction } from '@workspace/logger';
import { CONFIG } from '../../config';

// Only Staff role should be able to run /post-division-message command
const STAFF_ROLE_ID = CONFIG.STAFF_ROLE_ID;

export async function beforeExecute(ctx: MiddlewareContext) {
  const { interaction } = ctx;

  // Dev-mode bypass: allow during local development or explicit override
  const isDevEnv = process.env.ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development';
  const bypass = process.env.DEV_BYPASS_MIDDLEWARE === 'true';
  if (isDevEnv || bypass) return;

  if (!interaction.inGuild()) return;

  // Allow users with Administrator permission
  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    return;
  }

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
