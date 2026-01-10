import { Client, MessageFlags, Interaction, ButtonInteraction } from "discord.js";
import { prisma } from "@workspace/db";
import { setSelection, getAllSelections, clearReviewState } from "../../services/reviewStore.ts";
import { getPageNames, setPageNames, clearNamesForSession } from "../../services/nameCache.ts";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { syncNicknameAndSummarize } from "../../services/nicknameSync";
import { forInteraction } from "@workspace/logger";
import { getNotifyInfo, clearNotifyInfo } from "../../services/notifyStore";

export default async function (interaction: Interaction, client: Client) {
  // Only handle component interactions with our customId prefix
  if (!interaction.isButton()) return;
  const btn = interaction as ButtonInteraction;
  const id = interaction.customId;
  if (!id || !id.startsWith("eventrev:")) return;

  const log = forInteraction(interaction).child({ mod: "eventReview" });

  const parts = id.split(":");
  // Formats:
  // eventrev:rb:<sessionId>:<reviewerId>:<userId>:<choice>:<page>
  // eventrev:prev|next:<sessionId>:<reviewerId>:<page>
  // eventrev:confirm|nomerits:<sessionId>:<reviewerId>

  const action = parts[1];
  const sessionId = Number(parts[2]);
  const reviewerId: string = parts[3] || interaction.user.id;

  // Only the original reviewer can interact
  if (interaction.user.id !== reviewerId) {
    return interaction.reply({ content: "This review can only be edited by the moderator who started it.", flags: MessageFlags.Ephemeral });
  }

  // Helper to rebuild and update the ephemeral message
  const safeUpdate = async (data: any) => {
    try {
      // If not yet acknowledged, acknowledge quickly to avoid token expiry
      if (!btn.deferred && !btn.replied) {
        await btn.deferUpdate();
      }
    } catch {}
    try {
      return await btn.editReply(data as any);
    } catch (e) {
      // Fallback to update if still possible and not acknowledged (defensive)
      if (!btn.deferred && !btn.replied) {
        return await (btn as any).update(data);
      }
      throw e;
    }
  };

  // Helper to rebuild and update the ephemeral message
  const rebuild = async (page: number) => {
    // Defer immediately since the following DB work can exceed 3s
    if (!btn.deferred && !btn.replied) {
      try { await btn.deferUpdate(); } catch {}
    }
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return safeUpdate({ content: "Session no longer exists.", components: [], embeds: [] });
    }
    const participantsRaw = await prisma.eventSessionParticipant.findMany({
      where: { eventSessionId: sessionId },
    });
    const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const sessionSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));
    const participants = participantsRaw.sort((a, b) => {
      const aP = Math.max(0, a.totalSecondsPresent || 0);
      const aS = Math.max(0, a.totalSecondsSpeaking || 0);
      const bP = Math.max(0, b.totalSecondsPresent || 0);
      const bS = Math.max(0, b.totalSecondsSpeaking || 0);
      const aPct = sessionSeconds > 0 ? aS / sessionSeconds : 0;
      const bPct = sessionSeconds > 0 ? bS / sessionSeconds : 0;
      if (bPct !== aPct) return bPct - aPct;
      return bP - aP;
    });
    // Build name map via DB for speed
    const nameMap = getPageNames(sessionId, page) ?? new Map<string, string>();
    const ids = participants.map(p => p.userId);
    if (ids.length) {
      const t0 = Date.now();
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, nickname: true, name: true, username: true },
      });
      log.debug({ page, found: users.length, requested: ids.length, ms: Date.now() - t0 }, "DB name lookup");
      log.debug({ page, users }, "DB rows");
      const foundIds = new Set(users.map(u => u.id));
      const missing = ids.filter(id => !foundIds.has(id));
      if (missing.length) log.debug({ page, missing: missing.slice(0, 10), truncated: missing.length > 10 }, "DB missing ids");
      for (const u of users) {
        const disp = u.nickname || u.name || u.username || u.id;
        nameMap.set(u.id, disp);
      }
      const dbPreview = users.map(u => [u.id, nameMap.get(u.id)]);
      log.debug({ page, preview: dbPreview }, "DB nameMap preview");
      // Fallbacks from Discord caches for any missing, then override the current page with live guild display names
      const guild = btn.guild;
      for (const uid of ids) {
        if (!nameMap.has(uid) && guild) {
          const m = guild.members.cache.get(uid);
          if (m) nameMap.set(uid, m.displayName || m.user?.username || uid);
        }
        if (!nameMap.has(uid)) {
          const u = btn.client.users.cache.get(uid);
          if (u) nameMap.set(uid, u.username);
        }
        if (!nameMap.has(uid)) nameMap.set(uid, uid);
      }
      // Override names for just the current page (<=4 users)
      if (guild && !getPageNames(sessionId, page)) {
        try {
          const PAGE_SIZE = 4;
          const start = Math.max(0, page) * PAGE_SIZE;
          const pageIds = participants.slice(start, start + PAGE_SIZE).map(p => p.userId);
          if (pageIds.length) {
            const t1 = Date.now();
            const fetched = await guild.members.fetch({ user: pageIds, withPresences: false });
            log.debug({ page, fetched: fetched.size, requested: pageIds.length, ms: Date.now() - t1 }, "Guild fetch page");
            fetched.forEach(m => {
              nameMap.set(m.id, m.displayName || m.user.username || m.id);
            });
            setPageNames(sessionId, page, nameMap);
            const preview = participants.slice(start, start + PAGE_SIZE).map(p => [p.userId, nameMap.get(p.userId)]);
            log.debug({ page, preview }, "Page labels");
          }
        } catch {
          // ignore fetch errors
        }
      }
    }
    // sessionSeconds already computed above
    const mt = session?.meritTypeId ? await prisma.meritType.findUnique({ where: { id: session.meritTypeId! } }) : null;
    const message = buildEventReviewMessage({
      sessionId,
      channelId: session.channelId,
      sessionSeconds,
      participants,
      page,
      reviewerId,
      nameMap,
      awardDescription: session.awardDescription ?? undefined,
      meritTypeName: mt?.name,
      meritValue: (mt as any)?.value ?? undefined,
      minPercentPresent: (mt as any)?.minPercentPresent ?? undefined,
      minPercentNotMuted: (mt as any)?.minPercentNotMuted ?? undefined,
    });
    await safeUpdate(message as any);
  };

  if (action === "rb") {
    const userId = parts[4] || '';
    const choice = parts[5] as 'merit' | 'none';
    const page = Number(parts[6] ?? 0);
    if (!userId) return btn.reply({ content: "Missing user id in selection.", flags: MessageFlags.Ephemeral });
    if (choice !== 'merit' && choice !== 'none') {
      return btn.reply({ content: "Invalid selection.", flags: MessageFlags.Ephemeral });
    }
    setSelection(`${sessionId}:${reviewerId}`, userId, choice);
    return rebuild(page);
  }

  if (action === "prev" || action === "next") {
    if (!interaction.isButton()) return;
    const page = Number(parts[4] ?? 0);
    const newPage = action === "prev" ? Math.max(0, page - 1) : page + 1;
    return rebuild(newPage);
  }

  if (action === "confirm") {
    // Acknowledge quickly; we'll edit the original message afterwards
    if (!btn.deferred && !btn.replied) {
      try { await btn.deferUpdate(); } catch {}
    }
    // Immediately disable UI to reduce user double-clicks while we process
    try {
      await btn.editReply({ components: [] });
    } catch {}
    const selections = getAllSelections(`${sessionId}:${reviewerId}`);
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return safeUpdate({ content: "Session no longer exists.", components: [], embeds: [] });
    }
    // If already finalized (possibly due to another moderator), do not proceed
    try {
      if ((session as any).reviewFinalizedAt) {
        return safeUpdate({ content: `This event's review was already finalized by <@${(session as any).reviewFinalizedBy || 'unknown'}>.`, components: [], embeds: [] });
      }
    } catch {}
  let meritType: { id: number; name: string; description: string; value: number } | null = null;
    let awardDescription: string | undefined;
    // Fetch MeritType via Prisma relation (no raw SQL)
    const sessionWithType = await prisma.eventSession.findUnique({
      where: { id: sessionId },
      include: { meritType: true },
    });
    if (sessionWithType && sessionWithType.meritType) {
      const mt = sessionWithType.meritType;
      meritType = {
        id: mt.id,
        name: mt.name,
        description: mt.description,
        value: (mt as any).value ?? 0,
      };
      // Prefer the award description saved on the root session (or this one if root)
      awardDescription = sessionWithType.awardDescription ?? undefined;
      if (!awardDescription && sessionWithType.rootSessionId && sessionWithType.rootSessionId !== sessionWithType.id) {
        try {
          const root = await prisma.eventSession.findUnique({ where: { id: sessionWithType.rootSessionId } });
          if (root?.awardDescription) awardDescription = root.awardDescription;
        } catch { /* ignore */ }
      }
    }
    if (!meritType) {
      clearReviewState(`${sessionId}:${reviewerId}`);
      clearNamesForSession(sessionId);
      return safeUpdate({ content: `No merit type was set for session ${sessionId}. Nothing awarded.`, components: [], embeds: [] });
    }
    // Normalize selected user IDs and filter to those marked for merit
    const toAward = selections
      .filter(s => s.choice === 'merit')
      .map(s => ({ userId: s.userId || '' }))
      .filter(s => s.userId.length > 0);

    // Verify the users exist in nexus.user — never create users here
    const awardIds = Array.from(new Set(toAward.map(s => s.userId)));
    const existingUsers = awardIds.length
      ? await prisma.user.findMany({ where: { id: { in: awardIds } }, select: { id: true } })
      : [];
    const existingSet = new Set(existingUsers.map(u => u.id));
    const present = toAward.filter(s => existingSet.has(s.userId));
    const missing = awardIds.filter(id => !existingSet.has(id));
    if (missing.length) {
      log.warn({ sessionId, missing }, "Skipping users not found in DB");
    }
    const notes = `Awarded via event session ${sessionId}`;
    // Use a transaction with an advisory lock to ensure single-writer per session
    const awardedUserIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      try {
        // pg_advisory_xact_lock on sessionId to serialize concurrent confirms
        // Use a deterministic 32-bit key; here we just use sessionId directly
        await (tx as any).$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, sessionId);
      } catch {}
      // Filter out users already awarded for this session/type
      const existing = await tx.merit.findMany({
        where: {
          typeId: meritType!.id,
          additionalNotes: notes,
          userID: { in: present.map(p => p.userId) },
        },
        select: { userID: true },
      });
      const already = new Set(existing.map(e => e.userID));
      const toCreate = present.filter(p => !already.has(p.userId));
      if (toCreate.length) {
        // Prefer createMany with skipDuplicates if supported; unique index ensures idempotency
        try {
          await (tx.merit as any).createMany({
            data: toCreate.map(p => ({
              userID: p.userId,
              merits: meritType!.value,
              description: awardDescription || meritType!.description,
              additionalNotes: notes,
              awardedBy: reviewerId,
              typeId: meritType!.id,
            })),
            skipDuplicates: true,
          });
        } catch {
          // Fallback to individual creates ignoring unique violations
          for (const sel of toCreate) {
            try {
              await tx.merit.create({
                data: {
                  userID: sel.userId,
                  merits: meritType!.value,
                  description: awardDescription || meritType!.description,
                  additionalNotes: notes,
                  awardedBy: reviewerId,
                  typeId: meritType!.id,
                },
              });
            } catch {}
          }
        }
        awardedUserIds.push(...toCreate.map(t => t.userId));
      }
      // Mark session review finalized (idempotent)
      try {
        await tx.eventSession.update({
          where: { id: sessionId },
          data: { reviewFinalizedAt: new Date(), reviewFinalizedBy: reviewerId },
        });
      } catch {}
    });
    // Attempt nickname sync for awarded users and gather outcomes
    const syncSummaries: string[] = [];
    try {
      const guild = btn.guild;
      if (guild) {
        for (const uid of awardedUserIds) {
          try {
            const { outcome, message } = await syncNicknameAndSummarize({ guild, userID: uid });
            if (outcome.kind === 'skip' && outcome.reason === 'division_hidden') {
              // hidden division: no summary line
            } else if (outcome.kind === 'skip' && outcome.reason === 'missing_permissions_bypassed') {
              syncSummaries.push(`<@${uid}>: dev bypass (no Manage Nicknames/role hierarchy)`);
            } else if (outcome.kind === 'skip' && outcome.reason === 'member_not_found') {
              syncSummaries.push(`<@${uid}>: not in guild`);
            } else if (outcome.kind === 'error') {
              syncSummaries.push(`<@${uid}>: error ${message}`);
            } else if (outcome.kind === 'applied') {
              syncSummaries.push(`<@${uid}>: ${message}`);
            }
          } catch (e: any) {
            syncSummaries.push(`<@${uid}>: error ${String(e?.message ?? e)}`);
          }
        }
      }
    } catch { }
    clearReviewState(`${sessionId}:${reviewerId}`);
    clearNamesForSession(sessionId);
    const summary = present.length
      ? `Awarded ${meritType.value} merit(s) of type "${meritType.name}" to: ${present.map(s => `<@${s.userId}>`).join(', ')}`
      : `No merits awarded.`;
    const skipped = missing.length ? ` Skipped ${missing.length} user(s) not found in database: ${missing.map(id => `<@${id}>`).join(', ')}` : '';
    const syncNote = syncSummaries.length ? `\nNickname sync: ${syncSummaries.join('; ')}` : '';
    const descLine = awardDescription && awardDescription.trim().length ? `\nEvent: ${awardDescription.trim().slice(0, 255)}` : '';
    // Post final follow-up in inactivity thread
    try {
      const info = getNotifyInfo(sessionId);
      if (info?.threadId) {
        const guildId = btn.guildId || (await prisma.eventSession.findUnique({ where: { id: sessionId } }))?.guildId;
        if (guildId) {
          const guild = await btn.client.guilds.fetch(guildId);
          const thread = await guild.channels.fetch(info.threadId).catch(() => null as any);
          if (thread && (thread as any).isTextBased?.()) {
            await (thread as any).send(`Session ${sessionId} review complete. ${present.length ? 'Merits were awarded.' : 'No merits were awarded.'}`);
          }
        }
        clearNotifyInfo(sessionId);
      }
    } catch { /* ignore thread errors */ }
    return safeUpdate({ content: `Review confirmed for session ${sessionId}. ${summary}${skipped}${descLine}${syncNote}`.trim(), components: [], embeds: [] });
  }

  if (action === "nomerits") {
    // Disable UI and finalize this review as no-merits
    try { if (!btn.deferred && !btn.replied) { await btn.deferUpdate(); } } catch {}
    try { await btn.editReply({ components: [] }); } catch {}
    try {
      await prisma.$transaction(async (tx) => {
        try { await (tx as any).$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, sessionId); } catch {}
        const current = await tx.eventSession.findUnique({ where: { id: sessionId } });
        if (current && (current as any).reviewFinalizedAt) {
          // already finalized elsewhere
          return;
        }
        await tx.eventSession.update({
          where: { id: sessionId },
          data: { reviewFinalizedAt: new Date(), reviewFinalizedBy: reviewerId },
        });
      });
    } catch {}
    // Post final follow-up in inactivity thread
    try {
      const info = getNotifyInfo(sessionId);
      if (info?.threadId) {
        const guildId = btn.guildId || (await prisma.eventSession.findUnique({ where: { id: sessionId } }))?.guildId;
        if (guildId) {
          const guild = await btn.client.guilds.fetch(guildId);
          const thread = await guild.channels.fetch(info.threadId).catch(() => null as any);
          if (thread && (thread as any).isTextBased?.()) {
            await (thread as any).send(`Session ${sessionId} review complete. No merits were awarded.`);
          }
        }
        clearNotifyInfo(sessionId);
      }
    } catch { /* ignore thread errors */ }
    clearReviewState(`${sessionId}:${reviewerId}`);
    clearNamesForSession(sessionId);
    return safeUpdate({ content: `No merits will be assigned for session ${sessionId}.`, components: [], embeds: [] });
  }
}
