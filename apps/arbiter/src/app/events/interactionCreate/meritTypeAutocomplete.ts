import { Client, Interaction } from "discord.js";
import { prisma } from "@workspace/db";

// Handles autocomplete for the /event start merit_type option
export default async function (interaction: Interaction, client: Client) {
  if (!interaction.isAutocomplete()) return;
  const focused = interaction.options.getFocused(true);
  if (!focused || focused.name !== 'merit_type') return;

  const query = String(focused.value ?? '').toLowerCase().trim();
  console.log(`[EventStart] Autocomplete merit_type query="${query}"`);
  // Fetch up to 25 merit types (Discord limit) and filter by name/description/value
  const types = await prisma.meritType.findMany({ orderBy: { name: 'asc' }, take: 50 });
  const items = types
    .map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      value: (t as any).value ?? 0,
    }))
    .filter(t =>
      !query ||
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      String(t.id).includes(query) ||
      String(t.value).includes(query)
    )
    .slice(0, 25)
    .map(t => ({
      name: `${t.name} (${t.value}) — ${t.description}`.slice(0, 100),
      value: String(t.id),
    }));
  console.log(`[EventStart] Autocomplete responding with ${items.length} items`);
  await interaction.respond(items);
}
