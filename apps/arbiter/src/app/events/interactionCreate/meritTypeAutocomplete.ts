import { Client, Interaction } from "discord.js";
import { prisma } from "@workspace/db";
import { forInteraction } from "@workspace/logger";

// Handles autocomplete for the /event start merit_type option
export default async function (interaction: Interaction, client: Client) {
  if (!interaction.isAutocomplete()) return;
  const focused = interaction.options.getFocused(true);
  if (!focused || focused.name !== 'merit_type') return;

  const log = forInteraction(interaction).child({ mod: 'meritType', sub: 'autocomplete', field: 'merit_type' });
  const query = String(focused.value ?? '').toLowerCase().trim();
  const cmd = (interaction as any).commandName as string | undefined;
  log.debug({ query, cmd }, 'Autocomplete merit_type query');
  // For /event -> only isEvent types; for /add-merit -> any type
  const where = cmd === 'event' ? { isEvent: true } : {};
  // Fetch merit types; keep response capped to 25 (Discord limit)
  const types = await prisma.meritType.findMany({
    where,
    orderBy: [{ displayIndex: 'asc' }, { name: 'asc' }],
  });
  const items = types
    .map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      value: Number((t as any).value ?? 0),
    }))
    .filter(t => t.value !== 0)
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
  try {
    await interaction.respond(items);
  } catch (e: any) {
    // Autocomplete interactions expire quickly; log but don't crash
    if (e?.code === 10062 || e?.message?.includes('Unknown interaction')) {
      log.warn({ err: e?.message }, 'Autocomplete token expired (ignored)');
    } else {
      log.warn({ err: e }, 'Autocomplete response failed');
    }
  }
}
