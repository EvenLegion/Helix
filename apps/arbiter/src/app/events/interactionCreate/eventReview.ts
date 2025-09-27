import { Client, MessageFlags, Interaction } from "discord.js";
import { prisma } from "@workspace/db";
import { setSelection, getAllSelections, clearReviewState } from "../../services/reviewStore.ts";
import { getPageNames, setPageNames, clearNamesForSession } from "../../services/nameCache.ts";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";
import { syncNicknameAuto } from "../../services/rankSync.ts";
import { forInteraction } from "@workspace/logger";
import { getNotifyInfo, clearNotifyInfo } from "../../services/notifyStore";

export default async function (interaction: Interaction, client: Client) {
  // Only handle component interactions with our customId prefix
  if (!interaction.isButton()) return;
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
  const reviewerId = parts[3];

  // Only the original reviewer can interact
  if (interaction.user.id !== reviewerId) {
    return interaction.reply({ content: "This review can only be edited by the moderator who started it.", flags: MessageFlags.Ephemeral });
  }

  // Helper to rebuild and update the ephemeral message
  const rebuild = async (page: number) => {
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return interaction.update({ content: "Session no longer exists.", components: [], embeds: [] });
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
      const guild = interaction.guild;
      for (const uid of ids) {
        if (!nameMap.has(uid) && guild) {
          const m = guild.members.cache.get(uid);
          if (m) nameMap.set(uid, m.displayName || m.user?.username || uid);
        }
        if (!nameMap.has(uid)) {
          const u = interaction.client.users.cache.get(uid);
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
    await interaction.update(message as any);
  };

  if (action === "rb") {
    const userId = parts[4] || '';
    const choice = parts[5] as 'merit' | 'none';
    const page = Number(parts[6] ?? 0);
    if (!userId) return interaction.reply({ content: "Missing user id in selection.", flags: MessageFlags.Ephemeral });
    if (choice !== 'merit' && choice !== 'none') {
      return interaction.reply({ content: "Invalid selection.", flags: MessageFlags.Ephemeral });
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
    const selections = getAllSelections(`${sessionId}:${reviewerId}`);
    const session = await prisma.eventSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return interaction.update({ content: "Session no longer exists.", components: [], embeds: [] });
    }
    let meritType: { id: number; name: string; description: string; value: number } | null = null;
    let awardDescription: string | undefined;
    // Fetch MeritType via Prisma relation (no raw SQL)
    const sessionWithType = await prisma.eventSession.findUnique({
      where: { id: sessionId },
      include: { meritType: true },
    });
    if (sessionWithType?.meritType) {
      meritType = {
        id: sessionWithType.meritType.id,
        name: sessionWithType.meritType.name,
        description: sessionWithType.meritType.description,
        value: (sessionWithType.meritType as any).value ?? 0,
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
      return interaction.update({ content: `No merit type was set for session ${sessionId}. Nothing awarded.`, components: [], embeds: [] });
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
    const awardedUserIds: string[] = [];
    for (const sel of present) {
      // Always create a new Merit row per award
      await prisma.merit.create({
        data: {
          userID: sel.userId,
          merits: meritType.value,
          description: awardDescription || meritType.description,
          additionalNotes: notes,
          awardedBy: reviewerId,
          typeId: meritType.id,
        },
      });
      awardedUserIds.push(sel.userId);
    }
    // Attempt nickname sync for awarded users and gather outcomes
    const syncSummaries: string[] = [];
    try {
      const guild = interaction.guild;
      if (guild) {
        for (const uid of awardedUserIds) {
          try {
            const res: any = await syncNicknameAuto({ guild, userID: uid });
            if (res?.reason === 'missing_permissions_bypassed') {
              syncSummaries.push(`<@${uid}>: dev bypass (no Manage Nicknames/role hierarchy)`);
            } else if (res?.reason === 'member_not_found') {
              syncSummaries.push(`<@${uid}>: not in guild`);
            } else if (res?.reason === 'division_hidden') {
              // hidden divisions intentionally do not apply nicknames
            } else if (res?.reason === 'error') {
              const isMissing = res?.errorCode === 50013 || String(res?.error ?? '').includes('Missing Permissions');
              if (isMissing) {
                const detail = res?.permDetail === 'role_hierarchy'
                  ? 'blocked by role hierarchy'
                  : (res?.permDetail === 'missing_manage_nicknames' ? 'bot lacks Manage Nicknames' : 'Missing Permissions');
                syncSummaries.push(`<@${uid}>: error 50013 ${detail} (set DEV_ALLOW_NICK_EDIT=1 to bypass in dev)`);
              } else {
                syncSummaries.push(`<@${uid}>: error ${res.errorCode ?? ''} ${res.error ?? ''}`.trim());
              }
            } else if (res && 'applied' in res) {
              if (res.applied) syncSummaries.push(`<@${uid}>: ${res.before} → ${res.after}`);
              else syncSummaries.push(`<@${uid}>: no change`);
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
        const guildId = interaction.guildId || (await prisma.eventSession.findUnique({ where: { id: sessionId } }))?.guildId;
        if (guildId) {
          const guild = await interaction.client.guilds.fetch(guildId);
          const thread = await guild.channels.fetch(info.threadId).catch(() => null as any);
          if (thread && (thread as any).isTextBased?.()) {
            await (thread as any).send(`Session ${sessionId} review complete. ${present.length ? 'Merits were awarded.' : 'No merits were awarded.'}`);
          }
        }
        clearNotifyInfo(sessionId);
      }
    } catch { /* ignore thread errors */ }
    return interaction.update({ content: `Review confirmed for session ${sessionId}. ${summary}${skipped}${descLine}${syncNote}`.trim(), components: [], embeds: [] });
  }

  if (action === "nomerits") {
    clearReviewState(`${sessionId}:${reviewerId}`);
    clearNamesForSession(sessionId);
    return interaction.update({ content: `No merits will be assigned for session ${sessionId}.`, components: [], embeds: [] });
  }
}
