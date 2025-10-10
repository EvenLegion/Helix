import type { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";
import { forInteraction } from "@workspace/logger";

export const command: CommandData = {
  name: "list-discord-users",
  description: "List current server members (dev)"
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
  const log = forInteraction(interaction).child({ mod: "dev", cmd: "list-discord-users" });

  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Ensure we have the members cache. Requires Server Members Intent.
    await interaction.guild.members.fetch();

    const lines: string[] = [];
    for (const m of interaction.guild.members.cache.values()) {
      const name = m.displayName || m.user?.username || m.id;
      lines.push(`${m.id} — ${name}`);
    }

    // Discord message limit ~2000 chars; hard cap to keep safe
    const maxChars = 1900;
    let output = lines.join("\n");
    let truncated = false;
    if (output.length > maxChars) {
      output = output.slice(0, maxChars);
      truncated = true;
    }

    await interaction.editReply({
      content: truncated ? `${output}\n... (truncated)` : output,
    });
  } catch (err: any) {
    log.error({ err }, "Failed to list Discord users");
    await interaction.editReply({ content: `Failed: ${String(err?.message ?? err)}` });
  }
}
