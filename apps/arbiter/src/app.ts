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

// Dev-only: optional Prisma warmup to surface logging early and verify env propagation
const isOn = (v: unknown) => ["1", "true", "on", "yes"].includes(String(v ?? '').toLowerCase());
const wantWarmup = isOn(process.env.PRISMA_WARMUP || process.env.PRISMA_LOG_EVENTS || process.env.PRISMA_LOG_MW);
if (wantWarmup && process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      const log = childLogger({ mod: 'prisma', sub: 'warmup' });
      log.debug('ping...');
      // Cheap no-op query to establish connection and trigger logging banners
      await prisma.$queryRaw`SELECT 1`;
      log.debug('ready');
    } catch (e) {
      const log = childLogger({ mod: 'prisma', sub: 'warmup' });
      log.warn({ err: e }, 'failed');
    }
  })();
}