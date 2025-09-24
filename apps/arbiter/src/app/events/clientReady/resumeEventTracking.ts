import type { EventHandler } from 'commandkit';
import { childLogger } from '@workspace/logger';
import { prisma } from '@workspace/db';
import { startSessionTracker } from '../../services/sessionTracker';

const handler: EventHandler<'clientReady'> = async (client) => {
  const log = childLogger({ mod: 'eventTrack', sub: 'resume' });
  try {
    const active = await prisma.eventSession.findMany({ where: { status: 'ACTIVE' } });
    log.info({ count: active.length }, 'Resuming active event sessions on startup');
    for (const s of active) {
      try {
        await startSessionTracker(client, s.id, s.guildId, s.channelId);
        log.debug({ sessionId: s.id, guildId: s.guildId, channelId: s.channelId }, 'Resume started');
      } catch (e) {
        log.warn({ err: e, sessionId: s.id, guildId: s.guildId, channelId: s.channelId }, 'Failed to resume session');
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to query active sessions for resume');
  }
};

export default handler;
