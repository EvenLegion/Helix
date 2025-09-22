import { MiddlewareContext, stopMiddlewares } from "commandkit";
import { MessageFlags } from "discord.js";
import { forInteraction } from "@workspace/logger";

// Only Staff role should be able to run /rank commands (unless in dev mode)
// Staff role ID: 1364287451576930326
const STAFF_ROLE_ID = "1364287451576930326";

export async function beforeExecute(ctx: MiddlewareContext) {
  const { interaction } = ctx;

  // Dev-mode bypass: allow during local development or explicit override
  const isDevEnv =
    process.env.ENVIRONMENT === "development" ||
    process.env.NODE_ENV === "development";
  const bypass = process.env.DEV_BYPASS_MIDDLEWARE === "true";
  if (isDevEnv || bypass) return;

  if (!interaction.inGuild()) return; // slash commands in DMs are ignored elsewhere

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
      content: "You don’t have permission to use /rank commands.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const log = forInteraction(interaction).child({ mod: "middleware", group: "rank" });
  log.warn({ reason: "insufficient_role" }, "Blocked /rank due to missing Staff role");
  stopMiddlewares();
}
