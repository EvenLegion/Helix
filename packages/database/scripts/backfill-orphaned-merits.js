// Backfill orphaned arbiter.merit.userID references by creating minimal nexus.user rows
// Uses the generated Prisma client directly to avoid needing tsx/ts-node
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const main = async () => {
    console.log("[Backfill] Scanning for orphaned merits...");
    const merits = await prisma.merit.findMany({ select: { userID: true } });
    const ids = Array.from(new Set(merits.map((m) => (m.userID || "").trim()).filter(Boolean)));
    if (!ids.length) {
        console.log("[Backfill] No merits found.");
        return;
    }
    const existing = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const existingSet = new Set(existing.map((u) => u.id));
    const missing = ids.filter((id) => !existingSet.has(id));
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
            console.warn(`[Backfill] Failed to create user ${id}`, e?.message || e);
        }
    }
    console.log(`[Backfill] Done. Created ${created}/${missing.length}.`);
};

main()
    .catch((err) => {
        console.error("[Backfill] Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
