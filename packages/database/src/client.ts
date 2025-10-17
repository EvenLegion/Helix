// Use the generated Prisma client from this package to ensure models/types match our schema output
import { PrismaClient, Prisma } from '../generated/prisma/index.js'
import { withAccelerate } from '@prisma/extension-accelerate'

// Env helpers
const isOn = (v: unknown) => ["1", "true", "on", "yes"].includes(String(v ?? '').toLowerCase());
const LOG_EVENTS = isOn(process.env.PRISMA_LOG_EVENTS); // emit per-query events (SQL, params, duration)
const LOG_MW = isOn(process.env.PRISMA_LOG_MW); // middleware logs (model, action, duration, read/write)
const SLOW_MS = Number(process.env.PRISMA_SLOW_MS ?? '200'); // highlight slow queries
const MODEL_FILTER = (process.env.PRISMA_LOG_MODELS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const shouldLogModel = (model?: string) => !MODEL_FILTER.length || (model ? MODEL_FILTER.includes(model) : true);

// Latency simulation controls
const LAT_MS = process.env.PRISMA_LATENCY_MS ? Number(process.env.PRISMA_LATENCY_MS) : undefined; // fixed delay
const LAT_RANGE = (process.env.PRISMA_LATENCY_RANGE ?? '').split('-').map(s => s.trim()).filter(Boolean).map(Number);
const LAT_PCT = Number(process.env.PRISMA_LATENCY_PCT ?? '100'); // percentage of queries to delay
const LAT_MODELS = (process.env.PRISMA_LATENCY_MODELS ?? '').split(',').map(s => s.trim()).filter(Boolean); // optional model allowlist
const wantLatency = () => (Number.isFinite(LAT_MS) || (LAT_RANGE.length === 2 && LAT_RANGE.every(n => Number.isFinite(n)))) && LAT_PCT > 0;
const latencyMs = () => {
    if (Number.isFinite(LAT_MS)) return Math.max(0, Number(LAT_MS));
    if (LAT_RANGE.length === 2) {
        const [a, b] = LAT_RANGE as [number, number];
        const min = Math.max(0, Math.min(a, b));
        const max = Math.max(min, Math.max(a, b));
        return Math.floor(min + Math.random() * (max - min + 1));
    }
    return 0;
};
const shouldDelayModel = (model?: string) => !LAT_MODELS.length || (model ? LAT_MODELS.includes(model) : true);

const createPrismaClient = () => {
    // Always include a log property to satisfy types; we switch between event and empty array
    const logConfig: (Prisma.LogDefinition | Prisma.LogLevel)[] = LOG_EVENTS
        ? ([
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
        ])
        : ([]);

    // Configure base client first so $on/$use typings are preserved
    const base = new PrismaClient({ log: logConfig });

    // Config banner
    console.log(
        `[Prisma:cfg] events=${LOG_EVENTS ? 'on' : 'off'} mw=${LOG_MW ? 'on' : 'off'} slow>${SLOW_MS}ms` +
        (MODEL_FILTER.length ? ` models=[${MODEL_FILTER.join(',')}]` : '')
    );

    // Event-based logging (prints raw SQL and params)
    if (LOG_EVENTS) {
        base.$on('query', (e: Prisma.QueryEvent) => {
            const tag = e.duration > SLOW_MS ? 'SLOW' : 'OK';
            console.log(`[Prisma:event][${tag}] ${e.duration}ms ${e.query}`);
            if (e.params && e.params !== '[]') console.log(`  params: ${e.params}`);
        });
        base.$on('warn', (e: Prisma.LogEvent) => console.warn('[Prisma:warn]', e.message));
        base.$on('error', (e: Prisma.LogEvent) => console.error('[Prisma:error]', e.message));
        base.$on('info', (e: Prisma.LogEvent) => console.log('[Prisma:info]', e.message));
    }

    // Optional latency injection (simulate slow cloud DB)
    if (wantLatency()) {
        (base as any).$use(async (params: any, next: any) => {
            const model = String((params as any)?.model || 'unknown');
            if (!shouldDelayModel(model)) return next(params);
            if (Math.random() * 100 <= LAT_PCT) {
                const ms = latencyMs();
                if (ms > 0) await new Promise(res => setTimeout(res, ms));
            }
            return next(params);
        });
    }

    // Middleware-based logging (summarized reads/writes with timing)
    if (LOG_MW) {
        (base as any).$use(async (params: any, next: any) => {
            if (!shouldLogModel((params as { model?: string })?.model)) {
                return next(params);
            }
            const start = Date.now();
            const result = await next(params);
            const ms = Date.now() - start;
            const action = String((params as any)?.action || 'unknown');
            const model = String((params as any)?.model || 'unknown');
            const tag = ms > SLOW_MS ? 'SLOW' : 'OK';
            const WRITE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
            const READ = new Set(['findUnique', 'findFirst', 'findMany', 'aggregate', 'count', 'groupBy']);
            const kind = WRITE.has(action) ? 'WRITE' : READ.has(action) ? 'READ' : 'OTHER';
            let size = '';
            try {
                if (Array.isArray(result)) size = ` rows=${result.length}`;
                if (result && typeof result === 'object' && 'count' in (result as Record<string, unknown>)) {
                    const c = (result as Record<string, unknown>)['count'];
                    if (typeof c === 'number') size = ` count=${c}`;
                }
            } catch { }
            if (shouldLogModel(model)) {
                console.log(`[Prisma:mw][${tag}] ${ms}ms ${kind} ${model}.${action}${size}`);
            }
            return result;
        });
    }

    // Apply extensions last
    const client = base.$extends(withAccelerate());
    return client;
};

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

type GlobalPrisma = {
    prisma?: ExtendedPrismaClient;
    prismaCfgKey?: string;
};
const globalForPrisma = global as unknown as GlobalPrisma;

const cfgKey = JSON.stringify({ LOG_EVENTS, LOG_MW, SLOW_MS, MODEL_FILTER, LAT_MS, LAT_RANGE, LAT_PCT, LAT_MODELS });

if (!globalForPrisma.prisma || globalForPrisma.prismaCfgKey !== cfgKey) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaCfgKey = cfgKey;
}

export const prisma = globalForPrisma.prisma!;
