// Import MeritType rows from a JSON file created by export-merit-types.js
// Usage: pnpx node packages/database/scripts/import-merit-types.js path/to/file.json
import fs from 'fs';
import path from 'path';
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
    const fileArg = process.argv[2];
    if (!fileArg) {
        console.error('Usage: node import-merit-types.js <path-to-json>');
        process.exit(1);
    }
    const filePath = path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
        console.error(`[Import] File not found: ${filePath}`);
        process.exit(1);
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(content)) {
        console.error('[Import] File must contain a JSON array of MeritType objects');
        process.exit(1);
    }
    console.log(`[Import] Restoring ${content.length} MeritType row(s) from ${filePath}...`);
    let created = 0, updated = 0;
    for (const row of content) {
        // Accept id/name/description/value timestamps if present
        const data = {
            id: row.id,
            name: row.name,
            description: row.description,
            value: row.value ?? 0,
            createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
        };
        const exists = await prisma.meritType.findUnique({ where: { id: row.id } });
        if (exists) {
            await prisma.meritType.update({ where: { id: row.id }, data });
            updated++;
        } else {
            await prisma.meritType.create({ data });
            created++;
        }
    }
    console.log(`[Import] Done. Created=${created}, Updated=${updated}.`);
}

main()
    .catch((err) => { console.error('[Import] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
