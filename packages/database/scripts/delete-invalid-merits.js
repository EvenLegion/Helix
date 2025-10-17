// Optional cleanup for invalid merits that break Prisma Studio. DOES NOT TOUCH nexus.user.
// Run read-only by default. Set CONFIRM_DELETE=1 to actually delete.
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const main = async () => {
    const DRY_RUN = String(process.env.CONFIRM_DELETE ?? '') !== '1';
    console.log(`[Cleanup] Starting (dryRun=${DRY_RUN ? 'yes' : 'no'})`);

    // Find orphaned userIDs
    const orphanRows = await prisma.$queryRawUnsafe(
        `SELECT m."userID" AS "userId"
     FROM arbiter.merit m
     LEFT JOIN nexus."user" u ON u.id = m."userID"
     WHERE u.id IS NULL`
    );
    const orphans = Array.isArray(orphanRows) ? Array.from(new Set(orphanRows.map(r => (r.userId || '').trim()).filter(Boolean))) : [];

    // Find blanks
    const blankRows = await prisma.$queryRawUnsafe(
        `SELECT m."userID" AS "userId"
     FROM arbiter.merit m
     WHERE btrim(m."userID") = ''`
    );
    const blanks = Array.isArray(blankRows) ? Array.from(new Set(blankRows.map(r => (r.userId || '').trim()))) : [];

    console.log(`[Cleanup] Found ${orphans.length} orphaned Merit.userID and ${blanks.length} blank Merit.userID.`);
    if (orphans.length) console.log('[Cleanup] Orphan sample:', orphans.slice(0, 10));
    if (blanks.length) console.log('[Cleanup] Blank sample:', blanks.slice(0, 10));

    if (DRY_RUN) {
        console.log('[Cleanup] Dry run only. Set CONFIRM_DELETE=1 to delete invalid rows.');
        return;
    }

    // Delete invalid rows by IDs
    let deleted = 0;
    if (orphans.length) {
        const res = await prisma.merit.deleteMany({ where: { userID: { in: orphans } } });
        deleted += res.count;
    }
    if (blanks.length) {
        const res = await prisma.merit.deleteMany({ where: { userID: { in: blanks } } });
        deleted += res.count;
    }
    console.log(`[Cleanup] Deleted ${deleted} invalid Merit row(s).`);
};

main()
    .catch((err) => {
        console.error('[Cleanup] Error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
