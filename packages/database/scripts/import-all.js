// Import all tables from a directory of JSON files produced by export-all.js
// Usage: pnpm --filter @workspace/db exec node packages/database/scripts/import-all.js backups/20250921-112233
// Idempotent where possible: uses upserts keyed on natural/primary keys.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readArray(filePath, optional = false) {
    if (!fs.existsSync(filePath)) {
        if (optional) return [];
        throw new Error(`File not found: ${filePath}`);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) throw new Error(`Expected array in ${filePath}`);
    return data;
}

function toDate(v) { return v ? new Date(v) : undefined; }

function backupsRoot() { return path.resolve(__dirname, '..', 'backups'); }

function isStamp(arg) { return /^\d{8}-\d{6}$/.test(String(arg || '')); }

function findLatestBackupDir() {
    const root = backupsRoot();
    if (!fs.existsSync(root)) return null;
    const entries = fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .filter(isStamp)
        .sort((a, b) => b.localeCompare(a));
    if (!entries.length) return null;
    return path.join(root, entries[0]);
}

function resolveBackupDir(arg) {
    if (!arg) return null;
    if (String(arg).toLowerCase() === 'latest') {
        return findLatestBackupDir();
    }
    if (isStamp(arg)) {
        return path.join(backupsRoot(), arg);
    }
    // Fallback: treat as provided path (absolute or relative to cwd)
    return path.resolve(process.cwd(), arg);
}

async function main() {
    const dirArg = process.argv[2];
    if (!dirArg) {
        console.error('Usage: node import-all.js <backup-folder | YYYYMMDD-HHMMSS | latest>');
        console.error(`Examples:`);
        console.error(`  node import-all.js backups/20250921-112233`);
        console.error(`  node import-all.js 20250921-112233`);
        console.error(`  node import-all.js latest`);
        process.exit(1);
    }
    const dir = resolveBackupDir(dirArg);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        console.error(`[Import] Not a directory: ${dir}`);
        process.exit(1);
    }
    const stamp = path.basename(dir);
    console.log('[Import] Starting full import from', dir, `(stamp: ${stamp})`);

    const fp = (name) => path.join(dir, `${name}.json`);

    // Parents first
    const MeritType = readArray(fp('meritType'), true);
    for (const r of MeritType) {
        const data = { id: r.id, name: r.name, description: r.description, value: r.value ?? 0, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.meritType.findUnique({ where: { id: r.id } });
        if (exists) await prisma.meritType.update({ where: { id: r.id }, data }); else await prisma.meritType.create({ data });
    }
    console.log(`[Import] MeritType: ${MeritType.length}`);

    const RankLevel = readArray(fp('rankLevel'), true);
    for (const r of RankLevel) {
        const data = { level: r.level, cumulativeMerits: r.cumulativeMerits };
        const exists = await prisma.rankLevel.findUnique({ where: { level: r.level } });
        if (exists) await prisma.rankLevel.update({ where: { level: r.level }, data }); else await prisma.rankLevel.create({ data });
    }
    console.log(`[Import] RankLevel: ${RankLevel.length}`);

    const Division = readArray(fp('division'), true);
    for (const r of Division) {
        const data = { id: r.id, code: r.code, name: r.name, kind: r.kind, nicknamePrefix: r.nicknamePrefix, showRank: !!r.showRank, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.division.findUnique({ where: { id: r.id } });
        if (exists) await prisma.division.update({ where: { id: r.id }, data }); else await prisma.division.create({ data });
    }
    console.log(`[Import] Division: ${Division.length}`);

    const User = readArray(fp('user'), true);
    for (const r of User) {
        const data = { id: r.id, username: r.username, nickname: r.nickname, preferredName: r.preferredName, name: r.name, email: r.email, emailVerified: r.emailVerified, image: r.image, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.user.findUnique({ where: { id: r.id } });
        if (exists) await prisma.user.update({ where: { id: r.id }, data }); else await prisma.user.create({ data });
    }
    console.log(`[Import] User: ${User.length}`);

    // Dependents
    const DivisionMembership = readArray(fp('divisionMembership'), true);
    for (const r of DivisionMembership) {
        const data = { id: r.id, userID: r.userID, divisionId: r.divisionId, lastComputedLevel: r.lastComputedLevel, lastComputedAt: toDate(r.lastComputedAt), lastAppliedNicknameLevel: r.lastAppliedNicknameLevel, lastNicknameUpdatedAt: toDate(r.lastNicknameUpdatedAt), nicknameSyncStatus: r.nicknameSyncStatus, notes: r.notes };
        const exists = await prisma.divisionMembership.findUnique({ where: { id: r.id } });
        if (exists) await prisma.divisionMembership.update({ where: { id: r.id }, data }); else await prisma.divisionMembership.create({ data });
    }
    console.log(`[Import] DivisionMembership: ${DivisionMembership.length}`);

    const Merit = readArray(fp('merit'), true);
    for (const r of Merit) {
        const data = { userID: r.userID, merits: r.merits, description: r.description, additionalNotes: r.additionalNotes, awardedBy: r.awardedBy, createdAt: toDate(r.createdAt), typeId: r.typeId, updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.merit.findUnique({ where: { userID: r.userID } });
        if (exists) await prisma.merit.update({ where: { userID: r.userID }, data }); else await prisma.merit.create({ data });
    }
    console.log(`[Import] Merit: ${Merit.length}`);

    const EventType = readArray(fp('eventType'), true);
    for (const r of EventType) {
        const data = { id: r.id, name: r.name, description: r.description, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.eventType.findUnique({ where: { id: r.id } });
        if (exists) await prisma.eventType.update({ where: { id: r.id }, data }); else await prisma.eventType.create({ data });
    }
    console.log(`[Import] EventType: ${EventType.length}`);

    const Event = readArray(fp('event'), true);
    for (const r of Event) {
        const data = { id: r.id, name: r.name, description: r.description, createdAt: toDate(r.createdAt), eventDate: toDate(r.eventDate), typeId: r.typeId, updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.event.findUnique({ where: { id: r.id } });
        if (exists) await prisma.event.update({ where: { id: r.id }, data }); else await prisma.event.create({ data });
    }
    console.log(`[Import] Event: ${Event.length}`);

    const EventSession = readArray(fp('eventSession'), true);
    for (const r of EventSession) {
        const data = { id: r.id, rootSessionId: r.rootSessionId, guildId: r.guildId, channelId: r.channelId, createdByBot: !!r.createdByBot, startedBy: r.startedBy, startedAt: toDate(r.startedAt), endedAt: toDate(r.endedAt), status: r.status, meritTypeId: r.meritTypeId };
        const exists = await prisma.eventSession.findUnique({ where: { id: r.id } });
        if (exists) await prisma.eventSession.update({ where: { id: r.id }, data }); else await prisma.eventSession.create({ data });
    }
    console.log(`[Import] EventSession: ${EventSession.length}`);

    const EventSessionParticipant = readArray(fp('eventSessionParticipant'), true);
    for (const r of EventSessionParticipant) {
        const data = { id: r.id, eventSessionId: r.eventSessionId, userId: r.userId, totalSecondsPresent: r.totalSecondsPresent, totalSecondsSpeaking: r.totalSecondsSpeaking, lastJoinAt: toDate(r.lastJoinAt), lastSpeakAt: toDate(r.lastSpeakAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.eventSessionParticipant.findUnique({ where: { id: r.id } });
        if (exists) await prisma.eventSessionParticipant.update({ where: { id: r.id }, data }); else await prisma.eventSessionParticipant.create({ data });
    }
    console.log(`[Import] EventSessionParticipant: ${EventSessionParticipant.length}`);

    const NameChangeRequest = readArray(fp('nameChangeRequest'), true);
    for (const r of NameChangeRequest) {
        const data = { id: r.id, userId: r.userId, currentName: r.currentName, requestedName: r.requestedName, reason: r.reason, denyReason: r.denyReason, approved: !!r.approved, approvedBy: r.approvedBy, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.nameChangeRequest.findUnique({ where: { id: r.id } });
        if (exists) await prisma.nameChangeRequest.update({ where: { id: r.id }, data }); else await prisma.nameChangeRequest.create({ data });
    }
    console.log(`[Import] NameChangeRequest: ${NameChangeRequest.length}`);

    const Account = readArray(fp('account'), true);
    for (const r of Account) {
        const data = { id: r.id, accountId: r.accountId, providerId: r.providerId, userId: r.userId, accessToken: r.accessToken, refreshToken: r.refreshToken, idToken: r.idToken, accessTokenExpiresAt: toDate(r.accessTokenExpiresAt), refreshTokenExpiresAt: toDate(r.refreshTokenExpiresAt), scope: r.scope, password: r.password, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.account.findUnique({ where: { id: r.id } });
        if (exists) await prisma.account.update({ where: { id: r.id }, data }); else await prisma.account.create({ data });
    }
    console.log(`[Import] Account: ${Account.length}`);

    const Session = readArray(fp('session'), true);
    for (const r of Session) {
        const data = { id: r.id, expiresAt: toDate(r.expiresAt), token: r.token, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt), ipAddress: r.ipAddress, userAgent: r.userAgent, userId: r.userId };
        const exists = await prisma.session.findUnique({ where: { id: r.id } });
        if (exists) await prisma.session.update({ where: { id: r.id }, data }); else await prisma.session.create({ data });
    }
    console.log(`[Import] Session: ${Session.length}`);

    const Verification = readArray(fp('verification'), true);
    for (const r of Verification) {
        const data = { id: r.id, identifier: r.identifier, value: r.value, expiresAt: toDate(r.expiresAt), createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
        const exists = await prisma.verification.findUnique({ where: { id: r.id } });
        if (exists) await prisma.verification.update({ where: { id: r.id }, data }); else await prisma.verification.create({ data });
    }
    console.log(`[Import] Verification: ${Verification.length}`);

    console.log('[Import] Done.');
}

main()
    .catch((err) => { console.error('[Import] Error:', err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
