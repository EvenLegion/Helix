// Diagnose merits whose required user relation is missing (causes Prisma Studio error)
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const main = async () => {
    console.log("[Check] Looking for orphaned merits (no matching nexus.user)...");
    const rows = await prisma.$queryRawUnsafe(
        `SELECT m."userID" AS "userId"
     FROM arbiter.merit m
     LEFT JOIN nexus."user" u ON u.id = m."userID"
     WHERE u.id IS NULL
     LIMIT 50`
    );
    const list = Array.isArray(rows) ? rows : [];
    console.log(`[Check] Found ${list.length} sample orphan(s).`);
    if (list.length) {
        console.log("[Check] First few:", list.map(r => r.userId));
    }

    // Also detect blank/whitespace userIDs which cannot be backfilled
    const blanks = await prisma.$queryRawUnsafe(
        `SELECT m."userID" AS "userId"
     FROM arbiter.merit m
     WHERE btrim(m."userID") = ''
     LIMIT 50`
    );
    const blankList = Array.isArray(blanks) ? blanks : [];
    if (blankList.length) {
        console.warn(`[Check] Detected ${blankList.length} merit row(s) with blank/space-only userID (sample). These break the required relation.`);
        console.warn("[Check] First few blanks:", blankList.map(r => r.userId));
    }
};

main()
    .catch((err) => {
        console.error("[Check] Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
