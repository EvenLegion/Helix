import { prisma } from "@workspace/db";

async function main() {
  console.log("[Backfill] Scanning for orphaned merits...");
  // Get all userIDs from merit
  const merits = await prisma.merit.findMany({ select: { userID: true } });
  const ids = Array.from(new Set(merits.map(m => m.userID)));
  if (!ids.length) {
    console.log("[Backfill] No merits found.");
    return;
  }
  // Find which IDs are missing in nexus.user
  const existing = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const existingSet = new Set(existing.map(u => u.id));
  const missing = ids.filter(id => !existingSet.has(id));
  if (!missing.length) {
    console.log("[Backfill] No orphaned merits detected.");
    return;
  }
  console.log(`[Backfill] Creating ${missing.length} minimal user rows...`);
  let created = 0;
  for (const id of missing) {
    try {
      await prisma.user.create({ data: { id } });
      created++;
    } catch (e) {
      console.warn(`[Backfill] Failed to create user ${id}`, e);
    }
  }
  console.log(`[Backfill] Done. Created ${created}/${missing.length}.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
