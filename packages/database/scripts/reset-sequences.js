// Reset PostgreSQL sequences for serial/identity columns after imports without relying on hardcoded table lists
// Usage: pnpm run db:reset-sequences
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function discoverSequenceBackedColumns() {
    // information_schema.columns: column_default like nextval('schema.table_col_seq'::regclass)
    const rows = await prisma.$queryRawUnsafe(
        `SELECT table_schema AS schema, table_name AS table, column_name AS column
     FROM information_schema.columns
     WHERE column_default LIKE 'nextval(%'`
    );
    const list = Array.isArray(rows) ? rows : [];
    // Filter to our prisma schemas, if desired (arbiter and nexus). Keep general in case of future expansion.
    return list.filter(r => typeof r.schema === 'string' && (r.schema === 'arbiter' || r.schema === 'nexus'));
}

function quoteIdent(name) { return '"' + String(name).replaceAll('"', '""') + '"'; }
async function resetOne(schema, table, column) {
    const relQuoted = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    // Compute max first
    const maxRow = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX("${column}"), 0) AS max FROM ${relQuoted}`);
    const max = Number((Array.isArray(maxRow) && maxRow[0]?.max) ?? 0);
    if (max > 0) {
        const sql = `SELECT setval(pg_get_serial_sequence('${relQuoted}', '${column}'), ${max}, true)`;
        await prisma.$executeRawUnsafe(sql);
    } else {
        // Empty table: set to start at 1 and mark not called so nextval returns 1
        const sql = `SELECT setval(pg_get_serial_sequence('${relQuoted}', '${column}'), 1, false)`;
        await prisma.$executeRawUnsafe(sql);
    }
    console.log(`[Seq] Reset ${schema}.${table}("${column}") -> max=${max}`);
}

async function main() {
    console.log('[Seq] Discovering serial/identity columns…');
    const cols = await discoverSequenceBackedColumns();
    if (!cols.length) {
        console.log('[Seq] No sequence-backed columns discovered. Nothing to reset.');
        return;
    }
    // Group by table to log clearly
    for (const c of cols) {
        try {
            await resetOne(c.schema, c.table, c.column);
        } catch (e) {
            console.warn(`[Seq] Skip ${c.schema}.${c.table}("${c.column}"): ${String(e?.message ?? e)}`);
        }
    }
    console.log('[Seq] All discovered sequences processed.');
}

main().catch((err) => { console.error('[Seq] Error:', err); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
