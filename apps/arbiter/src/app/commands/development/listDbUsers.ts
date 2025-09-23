import type { CommandData, ChatInputCommandContext } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";

export const command: CommandData = {
  name: "list-db-users",
  description: "List users from the database (dev)"
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
  const log = forInteraction(interaction).child({ mod: "dev", cmd: "list-db-users" });

  if (!interaction.inGuild()) {
    return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, nickname: true }, orderBy: { id: "asc" } });
    const lines = users.map(u => `${u.id} — ${u.username ?? ""}${u.nickname ? ` (${u.nickname})` : ""}`);

    const maxChars = 1900;
    let output = lines.join("\n");
    let truncated = false;
    if (output.length > maxChars) {
      output = output.slice(0, maxChars);
      truncated = true;
    }

    await interaction.editReply({ content: truncated ? `${output}\n... (truncated)` : output });
  } catch (err: any) {
    log.error({ err }, "Failed to list DB users");
    await interaction.editReply({ content: `Failed: ${String(err?.message ?? err)}` });
  }
}
