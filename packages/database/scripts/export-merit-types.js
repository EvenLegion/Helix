// Export all MeritType rows to a timestamped JSON file under ../backups
// ORM-only; safe to run repeatedly
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '..', 'backups');

const stamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

async function main() {
    console.log('[Backup] Exporting MeritType rows...');
    const rows = await prisma.meritType.findMany({
        orderBy: { id: 'asc' },
    });
    console.log(`[Backup] Found ${rows.length} MeritType row(s).`);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `merit-types-${stamp()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`[Backup] Wrote ${rows.length} row(s) to ${filePath}`);
}

main()
    .catch((err) => { console.error('[Backup] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
