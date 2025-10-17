// Export all tables to a timestamped folder under ../backups/<stamp>
// Uses @prisma/client default output to avoid OneDrive EPERM issues.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Use the generated Prisma Client local to this package to ensure it matches the current schema (ESM explicit path)
import { PrismaClient, Prisma } from '../generated/prisma/index.js';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const outRoot = path.resolve(__dirname, '..', 'backups');

async function exportModel(name, rows) {
    const dir = getOutDir();
    const filePath = path.join(dir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`[Export] Wrote ${rows.length} ${name} row(s) to ${filePath}`);
}

async function exportIfExists(name, query) {
    try {
        const rows = await query();
        await exportModel(name, rows);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
            console.warn(`[Export] Skipping ${name}: table not found.`);
            return;
        }
        throw err;
    }
}

let outDirCache = null;
function getOutDir() {
    if (!outDirCache) {
        if (!fs.existsSync(outRoot)) fs.mkdirSync(outRoot, { recursive: true });
        outDirCache = path.join(outRoot, stamp());
        fs.mkdirSync(outDirCache, { recursive: true });
    }
    return outDirCache;
}

async function main() {
    console.log('[Export] Starting full export...');

    const tables = [
        // Parents first so imports can use simple upserts
        { name: 'meritType', query: () => prisma.meritType.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'rankLevel', query: () => prisma.rankLevel.findMany({ orderBy: { level: 'asc' } }) },
        { name: 'division', query: () => prisma.division.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'user', query: () => prisma.user.findMany({ orderBy: { id: 'asc' } }) },
        // Dependent tables
        { name: 'divisionMembership', query: () => prisma.divisionMembership.findMany({ orderBy: { id: 'asc' } }) },
        // Ordering by userID because sometimes we want to visually scan the json files for a specific user
        { name: 'merit', query: () => prisma.merit.findMany({ orderBy: { userID: 'asc' } }) },
        { name: 'eventType', query: () => prisma.eventType.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'event', query: () => prisma.event.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'eventSession', query: () => prisma.eventSession.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'eventSessionParticipant', query: () => prisma.eventSessionParticipant.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'nameChangeRequest', query: () => prisma.nameChangeRequest.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'account', query: () => prisma.account.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'session', query: () => prisma.session.findMany({ orderBy: { id: 'asc' } }) },
        { name: 'verification', query: () => prisma.verification.findMany({ orderBy: { id: 'asc' } }) },
    ];

    for (const { name, query } of tables) {
        await exportIfExists(name, query);
    }

    console.log(`[Export] Done. Folder: ${getOutDir()}`);
}

main()
    .catch((err) => { console.error('[Export] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
