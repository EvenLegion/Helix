import type { ChatInputCommandContext, CommandData } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { computeLevelForUser } from "../../services/rankSync.ts";

export const command: CommandData = {
  name: "get-merits",
  description: "Show total merits and rank for you or another user",
  options: [
    {
      name: "user",
      description: "User to check (optional)",
      type: 6, // USER
      required: false,
    },
  ],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
  try {
    const targetUser = interaction.options.getUser("user", false) ?? interaction.user;
    const targetId = targetUser.id;

    // Resolve a display name (prefer DB nickname/preferredName/username, then guild display, then username)
    let displayName = targetUser.username;
    try {
      const u = await prisma.user.findUnique({
        where: { id: targetId },
        select: { nickname: true, preferredName: true, username: true },
      });
      if (u) {
        displayName = (u.nickname || u.preferredName || u.username || displayName || targetId).trim();
      }
    } catch { /* ignore DB name lookup errors */ }
    if (interaction.guild) {
      try {
        const m = await interaction.guild.members.fetch(targetId);
        displayName = (m.nickname || (m as any).displayName || m.user?.username || displayName || targetId).toString();
      } catch { /* ignore guild fetch errors */ }
    }

    // Compute total merits and level (rank)
    const { merits, level } = await computeLevelForUser(targetId);

    // Fetch most recent merit entry for event description
    const last = await prisma.merit.findFirst({
      where: { userID: targetId },
      orderBy: { createdAt: "desc" },
      select: { description: true },
    });
    const lastEvent = (last?.description || "None").trim();

    const line1 = `${displayName} rank: ${level} based on ${merits} accumulated merits`;
    const line2 = `Most recent merits granted for event: ${lastEvent}`;

    return interaction.reply({ content: `${line1}\n${line2}`, flags: MessageFlags.Ephemeral });
  } catch (e: any) {
    const msg = `Error looking up merits: ${String(e?.message ?? e)}`;
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
}
