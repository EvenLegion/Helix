import type { ChatInputCommandContext, CommandData } from "commandkit";
import { MessageFlags } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";
import { syncNicknameAndSummarize } from "../../services/nicknameSync";

export const command: CommandData = {
  name: "add-merit",
  description: "Award merits to a user",
  options: [
    {
      name: "merit_type",
      description: "Merit type to award",
      type: 3, // STRING
      required: true,
      autocomplete: true,
    },
    {
      name: "description",
      description: "Reason/description (5–255 chars)",
      type: 3, // STRING
      required: true,
      min_length: 5,
      max_length: 255,
    },
    {
      name: "user",
      description: "User to award",
      type: 6, // USER
      required: true,
    },
  ],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
  const log = forInteraction(interaction).child({ mod: "add-merit" });
  try {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    }

    // Validate inputs
    const typeInput = interaction.options.getString("merit_type", true);
    const user = interaction.options.getUser("user", true);
    const description = interaction.options.getString("description", true).trim().slice(0, 255);

    // Resolve merit type; only allow event-eligible or all? We’ll allow any type here; adjust if needed.
    const types = await prisma.meritType.findMany({ orderBy: [{ displayIndex: "asc" }, { name: "asc" }] });
    const chosen = types.find(t => t.name === typeInput || String(t.id) === typeInput);
    if (!chosen) {
      const names = types.slice(0, 25).map(t => t.name).join(", ");
      return interaction.reply({ content: `Invalid merit type. Valid: ${names}${types.length > 25 ? " …" : ""}`, flags: MessageFlags.Ephemeral });
    }
    const merits = Math.max(0, Number((chosen as any).value ?? 0));
    if (!merits) {
      return interaction.reply({ content: `Selected merit type "${chosen.name}" has no configured value.`, flags: MessageFlags.Ephemeral });
    }

    if (description.length < 5) {
      return interaction.reply({ content: "Description must be at least 5 characters.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Create merit
    const created = await prisma.merit.create({
      data: {
        userID: user.id,
        merits,
        description,
        additionalNotes: " ",
        awardedBy: interaction.user.id,
        typeId: chosen.id,
      },
    });

    // Attempt to sync nickname decorations after award
    let syncNote = '';
    try {
      const guild = interaction.guild!;
      const { message } = await syncNicknameAndSummarize({ guild, userID: user.id });
      syncNote = ` Nickname: ${message}.`;
    } catch { }

    log.info({ awardedTo: user.id, merits, typeId: chosen.id, id: created.id }, "Merit awarded");
    return interaction.editReply({ content: `Awarded ${merits} merit(s) of type "${chosen.name}" to <@${user.id}>. Entry #${created.id}.${syncNote}`.trim() });
  } catch (e: any) {
    log.error({ err: e }, "Failed to award merit");
    const msg = `Failed to award merit: ${String(e?.message ?? e)}`;
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
}
