import { Client, MessageFlags, Interaction } from "discord.js";
import { prisma } from "@workspace/db";
import { setSelection, getAllSelections, clearReviewState } from "../../services/reviewStore.ts";
import { getPageNames, setPageNames, clearNamesForSession } from "../../services/nameCache.ts";
import { buildEventReviewMessage } from "../../ui/eventReview.ts";

export default async function (interaction: Interaction, client: Client) {
  // Only handle component interactions with our customId prefix
  if (!interaction.isButton()) return;
  const id = interaction.customId;
  if (!id || !id.startsWith("eventrev:")) return;

  const parts = id.split(":");
  // Formats:
  // eventrev:rb:<sessionId>:<reviewerId>:<userId>:<choice>:<page>
  // eventrev:prev|next:<sessionId>:<reviewerId>:<page>
  // eventrev:confirm|cancel:<sessionId>:<reviewerId>

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
    const participants = await prisma.eventSessionParticipant.findMany({
      where: { eventSessionId: sessionId },
      orderBy: { totalSecondsPresent: "desc" },
    });
    // Build name map via DB for speed
    const nameMap = getPageNames(sessionId, page) ?? new Map<string, string>();
    const ids = participants.map(p => (p.userId || '').trim());
    if (ids.length) {
      const t0 = Date.now();
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, nickname: true, name: true, username: true },
      });
      console.log(`[EventReview] DB name lookup (page ${page}): ${users.length}/${ids.length} in ${Date.now() - t0}ms`);
      console.log(`[EventReview] DB rows (page ${page}):`, users);
      const foundIds = new Set(users.map(u => u.id));
      const missing = ids.filter(id => !foundIds.has(id));
      if (missing.length) console.log(`[EventReview] DB missing ids (page ${page}):`, missing.slice(0, 10), missing.length > 10 ? '…' : '');
      for (const u of users) {
        const disp = u.nickname || u.name || u.username || u.id;
        nameMap.set(u.id, disp);
      }
      const dbPreview = users.map(u => [u.id, nameMap.get(u.id)]);
      console.log(`[EventReview] DB nameMap (page ${page}):`, dbPreview);
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
          const pageIds = participants.slice(start, start + PAGE_SIZE).map(p => (p.userId || '').trim());
          if (pageIds.length) {
            const t1 = Date.now();
            const fetched = await guild.members.fetch({ user: pageIds, withPresences: false });
            console.log(`[EventReview] Guild fetch page ${page}: fetched ${fetched.size}/${pageIds.length} in ${Date.now() - t1}ms`);
            fetched.forEach(m => {
              nameMap.set(m.id, m.displayName || m.user.username || m.id);
            });
            setPageNames(sessionId, page, nameMap);
            const preview = participants.slice(start, start + PAGE_SIZE).map(p => [p.userId, nameMap.get(p.userId)]);
            console.log(`[EventReview] Page ${page} labels:`, preview);
          }
        } catch {
          // ignore fetch errors
        }
      }
    }
    const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const sessionSeconds = Math.max(1, Math.floor((endedAt - startedAt) / 1000));
    const message = buildEventReviewMessage({
      sessionId,
      channelId: session.channelId,
      sessionSeconds,
      participants,
      page,
      reviewerId,
      nameMap,
    });
    await interaction.update(message as any);
  };

  if (action === "rb") {
    const userId = (parts[4] || '').trim();
    const choice = parts[5] as 'merit' | 'demerit' | 'none';
    const page = Number(parts[6] ?? 0);
    if (!userId) return interaction.reply({ content: "Missing user id in selection.", flags: MessageFlags.Ephemeral });
    if (choice !== 'merit' && choice !== 'demerit' && choice !== 'none') {
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
    clearReviewState(`${sessionId}:${reviewerId}`);
    clearNamesForSession(sessionId);
    const lines = selections.length
      ? selections.map(s => `• <@${s.userId}>: ${s.choice}`).join("\n")
      : "No selections made.";
    return interaction.update({
      content: `Review confirmed for session ${sessionId}.\n${lines}`,
      components: [],
      embeds: [],
    });
  }

  if (action === "cancel") {
    clearReviewState(`${sessionId}:${reviewerId}`);
    clearNamesForSession(sessionId);
    return interaction.update({ content: `Review cancelled for session ${sessionId}.`, components: [], embeds: [] });
  }
}
