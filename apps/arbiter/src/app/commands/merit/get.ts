import type { ChatInputCommandContext, CommandData } from "commandkit";
import { AttachmentBuilder, MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { computeLevelForUser } from "../../services/rankSync.ts";
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

    if (!includeDetails) {
      return interaction.reply({ content: `${line1}\n${line2}`, flags: MessageFlags.Ephemeral });
    }

    // Include full merit history as CSV, sorted by newest first (id desc)
    const entries = await prisma.merit.findMany({
      where: { userID: targetId },
      orderBy: { id: "desc" },
      select: {
        id: true,
        merits: true,
        description: true,
        additionalNotes: true,
        awardedBy: true,
      },
    });

    // Resolve awarder names: DB first, then guild members, then global user fetch
    const awarderIds = Array.from(new Set(entries.map(e => e.awardedBy).filter((v): v is string => !!v)));
    const awarderNameMap = new Map<string, string>();

    if (awarderIds.length) {
      try {
        const dbUsers = await prisma.user.findMany({
          where: { id: { in: awarderIds } },
          select: { id: true, nickname: true, preferredName: true, username: true },
        });
        for (const u of dbUsers) {
          const name = (u.nickname || u.preferredName || u.username || u.id).trim();
          awarderNameMap.set(u.id, name);
        }
      } catch { /* ignore */ }

      const unresolvedAfterDb = awarderIds.filter(id => !awarderNameMap.has(id));
      if (unresolvedAfterDb.length && interaction.guild) {
        try {
          const fetched = await interaction.guild.members.fetch({ user: unresolvedAfterDb });
          for (const [id, m] of fetched) {
            const name = (m.nickname || (m as any).displayName || m.user?.username || id).toString();
            awarderNameMap.set(id, name);
          }
        } catch { /* ignore guild fetch */ }
      }

      const stillUnresolved = awarderIds.filter(id => !awarderNameMap.has(id));
      for (const id of stillUnresolved) {
        try {
          const u = await interaction.client.users.fetch(id);
          awarderNameMap.set(id, u.username || id);
        } catch {
          awarderNameMap.set(id, id);
        }
      }
    }

    // Build CSV
    const csvHeader = "merits,description,awardedBy";
    const esc = (s: unknown) => {
      const v = s == null ? "" : String(s);
      return `"${v.replaceAll('"', '""')}"`;
    };
    const csvRows = entries.map(e => [
      esc(e.merits ?? 0),
      esc(e.description ?? ""),
      esc(e.awardedBy ? awarderNameMap.get(e.awardedBy) ?? e.awardedBy : e.awardedBy),
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
