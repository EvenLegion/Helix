// Read-only diagnostic: find Merit rows where Prisma resolves user relation as null
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const asPrintable = (s) => {
    const t = String(s ?? '');
    const hex = Array.from(t).map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    return { raw: t, length: t.length, hex };
};

const main = async () => {
    console.log('[Diag] Scanning merits for null user relation (read-only)…');
    const take = Number(process.env.TAKE ?? '2000');
    let skip = 0;
    let total = 0;
    let offenders = 0;
    while (true) {
        const rows = await prisma.merit.findMany({
            skip,
            take: Math.min(500, take),
            select: { userID: true, typeId: true, user: { select: { id: true } } },
            orderBy: { userID: 'asc' },
        });
        if (!rows.length) break;
        for (const r of rows) {
            total++;
            if (!r.user) {
                offenders++;
                const p = asPrintable(r.userID);
                console.log(`[Diag] NULL user for Merit.userID => raw:"${p.raw}" len=${p.length} hex=${p.hex} typeId=${r.typeId}`);
            }
        }
        skip += rows.length;
        if (total >= take) break;
    }
    console.log(`[Diag] Done. Scanned ${total} merit row(s). Null user relation rows: ${offenders}.`);
};

main()
    .catch((err) => { console.error('[Diag] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
