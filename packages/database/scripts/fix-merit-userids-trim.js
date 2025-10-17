// ORM-only fixer for Merit.userID strings with leading/trailing whitespace.
// Dry-run by default. Set CONFIRM_FIX=1 to perform the changes.
// Does not touch nexus.user, only arbiter.merit rows.
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const main = async () => {
    const DRY_RUN = String(process.env.CONFIRM_FIX ?? '') !== '1';
    console.log(`[Fix] Trimming Merit.userID values (dryRun=${DRY_RUN ? 'yes' : 'no'})`);

    // Fetch all merit rows; compare userID vs trimmed in JS to avoid raw SQL
    const merits = await prisma.merit.findMany({
        select: {
            userID: true,
            merits: true,
            description: true,
            additionalNotes: true,
            awardedBy: true,
            createdAt: true,
            updatedAt: true,
            typeId: true,
        },
        orderBy: { userID: 'asc' },
    });

    const candidates = merits.filter(m => String(m.userID ?? '') !== String(m.userID ?? '').trim());
    if (!candidates.length) {
        console.log('[Fix] No Merit.userID rows with leading/trailing whitespace found.');
        return;
    }
    console.log(`[Fix] Found ${candidates.length} candidate row(s).`);

    let fixed = 0;
    for (const m of candidates) {
        const raw = String(m.userID ?? '');
        const trimmed = raw.trim();
        const user = await prisma.user.findUnique({ where: { id: trimmed }, select: { id: true } });
        if (!user) {
            console.warn(`[Fix] Skipping: trimmed id has no matching user => raw="${raw}" -> trimmed="${trimmed}"`);
            continue;
        }
        console.log(`[Fix] ${DRY_RUN ? 'Would update' : 'Updating'} Merit.userID from "${raw}" -> "${trimmed}"`);
        if (DRY_RUN) continue;
        const res = await prisma.merit.updateMany({ where: { userID: raw }, data: { userID: trimmed } });
        fixed += res.count;
    }
    console.log(`[Fix] Done. ${fixed}/${candidates.length} moved.`);
};

main()
    .catch((err) => { console.error('[Fix] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
