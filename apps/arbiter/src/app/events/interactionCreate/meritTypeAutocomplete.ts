import { Client, Interaction } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";

// Handles autocomplete for the /event start merit_type option
export default async function (interaction: Interaction, client: Client) {
  if (!interaction.isAutocomplete()) return;
  const focused = interaction.options.getFocused(true);
  if (!focused || focused.name !== 'merit_type') return;

  const log = forInteraction(interaction).child({ mod: 'eventStart', sub: 'autocomplete', field: 'merit_type' });
  const query = String(focused.value ?? '').toLowerCase().trim();
  log.debug({ query }, 'Autocomplete merit_type query');
  // Fetch up to 25 merit types (Discord limit) and filter by name/description/value
  const types = await prisma.meritType.findMany({ orderBy: [{ displayIndex: 'asc' }, { name: 'asc' }], take: 50 });
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
      String(t.value).includes(query)
    )
    .slice(0, 25)
    .map(t => ({
      name: `${t.name} - ${t.description} (${t.value} merits)`.slice(0, 100),
      value: String(t.id),
    }));
  log.debug({ count: items.length }, 'Autocomplete responding');
  await interaction.respond(items);
}
