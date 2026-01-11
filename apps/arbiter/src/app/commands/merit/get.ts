import type { ChatInputCommandContext, CommandData } from "commandkit";
import { AttachmentBuilder, MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { computeLevelForUser } from "../../services/rankSync.ts";
import { resolveDisplayName, resolveUserNameMap } from "../../services/nameResolver.ts";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

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
    {
      name: "details",
      description: "Include full merit history as CSV",
      type: 5, // BOOLEAN
      required: false,
    },
  ],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
  try {
    const targetUser = interaction.options.getUser("user", false) ?? interaction.user;
    const includeDetails = interaction.options.getBoolean("details", false) ?? false;
    const targetId = targetUser.id;

    if (includeDetails) {
      // We may need extra time to build CSV; defer early if details requested.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // Resolve a display name using centralized helper
    const displayName = await resolveDisplayName({
      client: interaction.client,
      guild: interaction.guild ?? undefined,
      userId: targetId,
      fallbackUsername: targetUser.username,
    });

    // Compute total merits and level (rank)
    const { merits, level } = await computeLevelForUser(targetId);

    // Fetch most recent merit entry for event description
    const last = await prisma.merit.findFirst({
      where: { userID: targetId },
      orderBy: { created_at: "desc" },
      select: { description: true },
    });
    const lastEvent = (last?.description || "None").trim();

    const line1 = `${displayName} rank: ${level} based on ${merits} accumulated merits`;
    const line2 = `Most recent merits granted for event: ${lastEvent}`;

    if (!includeDetails) {
      return interaction.reply({ content: `${line1}\n${line2}`, flags: MessageFlags.Ephemeral });
    }

    // Include full merit history as CSV, sorted by newest first (created_at desc)
    const entries = await prisma.merit.findMany({
      where: { userID: targetId },
      orderBy: { created_at: "desc" },
      select: {
        merits: true,
        description: true,
        additional_notes: true,
        awarded_by: true,
      },
    });

    // Resolve awarder names: DB first, then guild members, then global user fetch
    const awarderIds = Array.from(new Set(entries.map(e => e.awarded_by).filter((v): v is string => !!v)));
    const awarderNameMap = await resolveUserNameMap({
      client: interaction.client,
      guild: interaction.guild ?? undefined,
      userIds: awarderIds,
    });

    // Build CSV
    const csvHeader = "merits,description,awardedBy";
    const esc = (s: unknown) => {
      const v = s == null ? "" : String(s);
      return `"${v.replaceAll('"', '""')}"`;
    };
    const csvRows = entries.map(e => [
      esc(e.merits ?? 0),
      esc(e.description ?? ""),
      esc(e.awarded_by ? awarderNameMap.get(e.awarded_by) ?? e.awarded_by : e.awarded_by),
    ].join(","));
    const csvContent = [csvHeader, ...csvRows].join(os.EOL);

    // Write CSV to temp and attach
    const safeBase = displayName.replace(/[^\w.-]+/g, "_").slice(0, 64) || targetId;
    const filePath = path.join(os.tmpdir(), `merits-${safeBase}-${Date.now()}.csv`);
    fs.writeFileSync(filePath, csvContent, "utf8");
    const attachment = new AttachmentBuilder(filePath).setName(`${safeBase}_merits.csv`);

    await interaction.editReply({
      content: `${line1}\n${line2}\nTotal entries: ${entries.length}`,
      files: [attachment],
    });

    setTimeout(() => {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }, 10000);

    return;
  } catch (e: any) {
    const msg = `Error looking up merits: ${String(e?.message ?? e)}`;
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
}
