import { MessageFlags } from "discord.js";

export function ensureGuild(interaction: any): asserts interaction is { guild: any; reply: Function; } {
  if (!interaction?.guild) {
    throw new Error("GUILD_REQUIRED");
  }
}

export async function replyGuildRequired(interaction: any) {
  try {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
  } catch { }
}

export async function safeExecute<T>(fn: () => Promise<T>, onError: (err: unknown) => Promise<void> | void) {
  try {
    return await fn();
  } catch (err) {
    await onError(err);
    return undefined as unknown as T;
  }
}
