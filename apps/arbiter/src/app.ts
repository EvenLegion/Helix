import { Client } from 'discord.js';
import { prisma } from '@workspace/db';
import { childLogger } from '@workspace/logger';

const client = new Client({
  intents: [
    'Guilds',
    'GuildMembers',
    'GuildMessages',
    'MessageContent',
    'GuildMessageReactions',
    'GuildVoiceStates'
  ],
});

export default client;

// In dev, always log a masked snapshot of DATABASE_URL to quickly diagnose env mismatches
if (process.env.NODE_ENV !== 'production') {
  const maskConnection = (u?: string) => {
    if (!u) return '(unset)';
    try {
      const m = u.match(/^([^:]+):\/\/([^@]+)@([^/]+)\/(.+)$/);
      if (!m) return '(unparseable)';
      const driver = m[1] ?? 'db';
      // user:pass may be present; hide pass
      const rawUser = m[2] ?? '';
      const user = rawUser.includes(':') ? rawUser.split(':')[0] : rawUser;
      const host = m[3] ?? 'host';
      const db = m[4] ?? 'database';
      return `${driver}://${user}:****@${host}/${db}`;
    } catch {
      return '(unparseable)';
    }
  };
  const log = childLogger({ mod: 'env', sub: 'db' });
  log.info({ DATABASE_URL: maskConnection(process.env.DATABASE_URL) }, 'DB target');
}

// Dev-only: optional Prisma warmup to surface logging early and verify env propagation
const isOn = (v: unknown) => ["1", "true", "on", "yes"].includes(String(v ?? '').toLowerCase());
const wantWarmup = isOn(process.env.PRISMA_WARMUP || process.env.PRISMA_LOG_EVENTS || process.env.PRISMA_LOG_MW);
if (wantWarmup && process.env.NODE_ENV !== 'production') {
  const maskUrl = (u?: string) => (u ? u.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@') : '(unset)');
  const log = childLogger({ mod: 'prisma', sub: 'warmup' });
  log.debug({ DATABASE_URL: maskUrl(process.env.DATABASE_URL) }, 'env check');
  (async () => {
    try {
      log.debug('ping...');
      // Cheap no-op query to establish connection and trigger logging banners
      await prisma.$queryRaw`SELECT 1`;
      log.debug('ready');
    } catch (e) {
      log.warn({ err: e }, 'failed');
    }
  })();
}