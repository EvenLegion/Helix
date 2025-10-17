// Verify PostgreSQL sequences for serial/identity columns; optionally fix when behind MAX(id)
// Usage:
//   node ./scripts/verify-sequences.js           # report only
//   node ./scripts/verify-sequences.js --fix     # fix by setting sequence to MAX(id)
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function discoverSequenceBackedColumns() {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT table_schema AS schema, table_name AS table, column_name AS column
     FROM information_schema.columns
     WHERE column_default LIKE 'nextval(%'`
    );
    const list = Array.isArray(rows) ? rows : [];
    return list.filter(r => typeof r.schema === 'string' && (r.schema === 'arbiter' || r.schema === 'nexus'));
}

async function getSeqName(schema, table, column) {
    const res = await prisma.$queryRawUnsafe(
        `SELECT pg_get_serial_sequence('"${schema}"."${table}"', '${column}') AS seq`
    );
    const row = Array.isArray(res) ? res[0] : null;
    return row?.seq || null;
}

async function getSeqLastValue(seqName) {
    // seqName is like 'schema.seqname' (already resolved by pg_get_serial_sequence)
    const res = await prisma.$queryRawUnsafe(`SELECT last_value, is_called FROM ${seqName}`);
    const row = Array.isArray(res) ? res[0] : null;
    return row || null;
}

async function getMaxId(schema, table, column) {
    const res = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(MAX("${column}"), 0) AS max FROM "${schema}"."${table}"`
    );
    const row = Array.isArray(res) ? res[0] : null;
    return Number(row?.max ?? 0);
}

async function setSeq(schema, table, column, value) {
    const rel = `${schema}.${table}`;
    await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('${rel}', '${column}'), ${Number(value)}, true)`
    );
}

async function main() {
    const fix = process.argv.includes('--fix');
    console.log(`[Seq:Verify] Discovering serial/identity columns…`);
    const cols = await discoverSequenceBackedColumns();
    if (!cols.length) {
        console.log('[Seq:Verify] No sequence-backed columns found.');
        return;
    }
    let issues = 0;
    for (const c of cols) {
        try {
            const seq = await getSeqName(c.schema, c.table, c.column);
            if (!seq) { console.warn(`[Seq:Verify] No sequence for ${c.schema}.${c.table}("${c.column}")`); continue; }
            const last = await getSeqLastValue(seq);
            const max = await getMaxId(c.schema, c.table, c.column);
            const lastVal = Number(last?.last_value ?? 0);
            const needs = lastVal < max;
            const status = needs ? 'BEHIND' : 'OK';
            console.log(`[Seq:Verify] ${status} ${c.schema}.${c.table}("${c.column}") seq=${seq} last=${lastVal} max=${max}`);
            if (needs) {
                issues++;
                if (fix) {
                    await setSeq(c.schema, c.table, c.column, max);
                    console.log(`  -> Fixed to ${max}`);
                }
            }
        } catch (e) {
            console.warn(`[Seq:Verify] Skip ${c.schema}.${c.table}("${c.column}"): ${String(e?.message ?? e)}`);
        }
    }
    if (issues && !fix) {
        console.log(`[Seq:Verify] ${issues} sequences behind. Run with --fix or use db:reset-sequences to correct.`);
    }
}

main().catch((err) => { console.error('[Seq:Verify] Error:', err); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
