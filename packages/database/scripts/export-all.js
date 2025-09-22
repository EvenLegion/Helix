// Export all tables to a timestamped folder under ../backups/<stamp>
// Uses @prisma/client default output to avoid OneDrive EPERM issues.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

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

    // Export order: parents first so imports can use simple upserts
    const MeritType = await prisma.meritType.findMany({ orderBy: { id: 'asc' } });
    await exportModel('meritType', MeritType);

    const RankLevel = await prisma.rankLevel.findMany({ orderBy: { level: 'asc' } });
    await exportModel('rankLevel', RankLevel);

    const Division = await prisma.division.findMany({ orderBy: { id: 'asc' } });
    await exportModel('division', Division);

    const User = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    await exportModel('user', User);

    // Dependent tables
    const DivisionMembership = await prisma.divisionMembership.findMany({ orderBy: { id: 'asc' } });
    await exportModel('divisionMembership', DivisionMembership);

    const Merit = await prisma.merit.findMany({ orderBy: { userID: 'asc' } });
    await exportModel('merit', Merit);

    const EventType = await prisma.eventType.findMany({ orderBy: { id: 'asc' } });
    await exportModel('eventType', EventType);

    const Event = await prisma.event.findMany({ orderBy: { id: 'asc' } });
    await exportModel('event', Event);

    const EventSession = await prisma.eventSession.findMany({ orderBy: { id: 'asc' } });
    await exportModel('eventSession', EventSession);

    const EventSessionParticipant = await prisma.eventSessionParticipant.findMany({ orderBy: { id: 'asc' } });
    await exportModel('eventSessionParticipant', EventSessionParticipant);

    const NameChangeRequest = await prisma.nameChangeRequest.findMany({ orderBy: { id: 'asc' } });
    await exportModel('nameChangeRequest', NameChangeRequest);

    const Account = await prisma.account.findMany({ orderBy: { id: 'asc' } });
    await exportModel('account', Account);

    const Session = await prisma.session.findMany({ orderBy: { id: 'asc' } });
    await exportModel('session', Session);

    const Verification = await prisma.verification.findMany({ orderBy: { id: 'asc' } });
    await exportModel('verification', Verification);

    console.log(`[Export] Done. Folder: ${getOutDir()}`);
}

main()
    .catch((err) => { console.error('[Export] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
