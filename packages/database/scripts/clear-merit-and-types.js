// Clear arbiter.merit and arbiter.meritType in safe FK order using Prisma ORM
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    console.log('[Clear] Deleting all Merit rows...');
    const delMerit = await prisma.merit.deleteMany({});
    console.log(`[Clear] Deleted ${delMerit.count} Merit row(s).`);

    console.log('[Clear] Deleting all MeritType rows...');
    const delTypes = await prisma.meritType.deleteMany({});
    console.log(`[Clear] Deleted ${delTypes.count} MeritType row(s).`);
}

main()
    .catch((err) => { console.error('[Clear] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
