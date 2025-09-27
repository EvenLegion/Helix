// Use the generated Prisma client from this package to ensure models/types match our schema output
import { PrismaClient } from '../generated/prisma/index.js'
import { withAccelerate } from '@prisma/extension-accelerate'

// Env helpers
const isOn = (v: unknown) => ["1", "true", "on", "yes"].includes(String(v ?? '').toLowerCase());
const LOG_EVENTS = isOn(process.env.PRISMA_LOG_EVENTS); // emit per-query events (SQL, params, duration)
const LOG_MW = isOn(process.env.PRISMA_LOG_MW); // middleware logs (model, action, duration, read/write)
const SLOW_MS = Number(process.env.PRISMA_SLOW_MS ?? '200'); // highlight slow queries
const MODEL_FILTER = (process.env.PRISMA_LOG_MODELS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const shouldLogModel = (model?: string) => !MODEL_FILTER.length || (model ? MODEL_FILTER.includes(model) : true);

const createPrismaClient = () => {
    // Always include a log property to satisfy types; we switch between event and empty array
    const logConfig = LOG_EVENTS
        ? ([
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
        ] as const)
        : ([] as any);

    const client = new PrismaClient({ log: logConfig } as any).$extends(withAccelerate());
    // Config banner
    console.log(
        `[Prisma:cfg] events=${LOG_EVENTS ? 'on' : 'off'} mw=${LOG_MW ? 'on' : 'off'} slow>${SLOW_MS}ms` +
        (MODEL_FILTER.length ? ` models=[${MODEL_FILTER.join(',')}]` : '')
    );

    // Event-based logging (prints raw SQL and params)
    if (LOG_EVENTS) {
        (client as any).$on('query', (e: any) => {
            // Note: Prisma query events may not include model; we log regardless of model filter
            const tag = e.duration > SLOW_MS ? 'SLOW' : 'OK';
            console.log(`[Prisma:event][${tag}] ${e.duration}ms ${e.query}`);
            if (e.params && e.params !== '[]') console.log(`  params: ${e.params}`);
        });
        (client as any).$on('warn', (e: any) => console.warn('[Prisma:warn]', e.message));
        (client as any).$on('error', (e: any) => console.error('[Prisma:error]', e.message));
        (client as any).$on('info', (e: any) => console.log('[Prisma:info]', e.message));
    }

    // Middleware-based logging (summarized reads/writes with timing)
    if (LOG_MW) {
        (client as any).$use(async (params: any, next: any) => {
            if (!shouldLogModel(params?.model)) {
                return next(params);
            }
            const start = Date.now();
            try {
                const result = await next(params);
                const dur = Date.now() - start;
                const action: string = params?.action;
                const model: string | undefined = params?.model;
                const WRITE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
                const READ = new Set(['findUnique', 'findFirst', 'findMany', 'aggregate', 'count', 'groupBy']);
                const kind = WRITE.has(action) ? 'WRITE' : READ.has(action) ? 'READ' : 'OTHER';
                const tag = dur > SLOW_MS ? 'SLOW' : 'OK';
                let size = '';
                if (Array.isArray(result)) size = ` size=${result.length}`;
                else if (result && typeof result === 'object') {
                    if ('count' in result && typeof (result as any).count === 'number') size = ` count=${(result as any).count}`;
                }
                const whereKeys = params?.args?.where ? Object.keys(params.args.where).join(',') : '';
                console.log(`[Prisma:mw][${tag}] ${dur}ms ${kind} ${model}.${action}${whereKeys ? ` where=[${whereKeys}]` : ''}${size}`);
                return result;
            } catch (err) {
                const dur = Date.now() - start;
                console.error(`[Prisma:mw][ERR] ${dur}ms ${params?.model}.${params?.action}`, err);
                throw err;
            }
        });
    }

    return client;
};

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

type GlobalPrisma = {
    prisma?: ExtendedPrismaClient;
    prismaCfgKey?: string;
};
const globalForPrisma = global as unknown as GlobalPrisma;

const cfgKey = JSON.stringify({ LOG_EVENTS, LOG_MW, SLOW_MS, MODEL_FILTER });

if (!globalForPrisma.prisma || globalForPrisma.prismaCfgKey !== cfgKey) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaCfgKey = cfgKey;
}

export const prisma = globalForPrisma.prisma!;
