// Read-only: scan Merit.userID values vs existing User ids without loading relations
// Goal: find userID strings that do not exactly match a User.id (potential whitespace/typo)
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const hexify = (s) => Array.from(String(s ?? '')).map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');

const main = async () => {
    const LIMIT = Number(process.env.TAKE ?? '5000');
    const PAGE = 500;
    let skip = 0;
    let total = 0;
    const originals = new Set();
    const samples = [];

    console.log(`[Scan] Collecting Merit.userID (no relations)…`);
    while (true) {
        const rows = await prisma.merit.findMany({
            skip,
            take: Math.min(PAGE, LIMIT - total),
            select: { userID: true },
            orderBy: { userID: 'asc' },
        });
        if (!rows.length) break;
        for (const r of rows) {
            const raw = String(r.userID ?? '');
            originals.add(raw);
            if (samples.length < 20) samples.push(raw);
            total++;
        }
        skip += rows.length;
        if (total >= LIMIT) break;
    }
    console.log(`[Scan] Collected ${total} Merit rows; unique userID strings=${originals.size}. Sample:`, samples);

    // Query existing users for the exact original strings (no trim)
    const ids = Array.from(originals);
    const existing = new Set();
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const users = await prisma.user.findMany({ where: { id: { in: chunk } }, select: { id: true } });
        for (const u of users) existing.add(u.id);
    }

    // Compute mismatches and whitespace suspects
    const mismatches = [];
    const whitespaceSuspects = [];
    for (const raw of ids) {
        if (!existing.has(raw)) {
            const trimmed = raw.trim();
            // If the trimmed version exists as a user id, call that out explicitly
            if (trimmed && trimmed !== raw && existing.has(trimmed)) {
                whitespaceSuspects.push({ raw, trimmed, rawHex: hexify(raw) });
            } else {
                mismatches.push({ raw, rawHex: hexify(raw) });
            }
        }
    }

    console.log(`[Scan] Exact mismatches (no matching User.id) = ${mismatches.length}`);
    if (mismatches.length) console.log('[Scan] Mismatch sample:', mismatches.slice(0, 10));
    console.log(`[Scan] Whitespace/format suspects (trimmed matches a User.id) = ${whitespaceSuspects.length}`);
    if (whitespaceSuspects.length) console.log('[Scan] Suspect sample:', whitespaceSuspects.slice(0, 10));
};

main()
    .catch((err) => { console.error('[Scan] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
