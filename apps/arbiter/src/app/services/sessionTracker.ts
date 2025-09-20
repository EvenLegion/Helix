import { ChannelType, VoiceChannel, StageChannel } from "discord.js";
import { prisma } from "@workspace/db";

const activeTimers = new Map<number, NodeJS.Timeout>();
const prevMembersBySession = new Map<number, Set<string>>();
const prevMemberNamesBySession = new Map<number, Map<string, string>>();

// Simple sampling approach: every SAMPLE_SECONDS, count present members and increment totals.
// Speaking detection is non-trivial via discord.js; speaking events require a voice receiver/bot in channel.
// For now, we approximate speaking as "unmuted and not deafened". Can be replaced with proper audio/speaking integration later.
const SAMPLE_SECONDS = 15;
const VERBOSE = ["1", "true", "on", "yes"].includes(String(process.env.EVENT_TRACK_VERBOSE || "").toLowerCase());

export async function startSessionTracker(client: any, sessionId: number, guildId: string, vcId: string) {
  // Avoid duplicate trackers per session
  if (activeTimers.has(sessionId)) return;

  const tick = async () => {
    try {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.get(vcId) ?? await guild.channels.fetch(vcId);
      if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
        // End session if channel not found
        await prisma.eventSession.update({ where: { id: sessionId }, data: { endedAt: new Date(), status: "ENDED" } });
        console.log(`[EventTrack] Session ${sessionId}: channel ${vcId} not found; ending session.`);
        stopSessionTracker(sessionId);
        return;
      }

      const vc = channel as VoiceChannel | StageChannel;
      // Ensure members cache
      await vc.guild.members.fetch();

      // Members currently connected
      const members = vc.members;
      const now = new Date();

      // Upsert participants and add SAMPLE_SECONDS to presence time for everyone connected
      for (const [memberId, member] of members) {
        await prisma.eventSessionParticipant.upsert({
          where: { eventSessionId_userId: { eventSessionId: sessionId, userId: memberId } },
          create: {
            eventSessionId: sessionId,
            userId: memberId,
            totalSecondsPresent: SAMPLE_SECONDS,
            lastJoinAt: now,
          },
          update: {
            totalSecondsPresent: { increment: SAMPLE_SECONDS },
            lastJoinAt: now,
          },
        });
      }

      // Naive speaking approximation: increment speaking time for those not self-muted and not server-muted
      for (const [memberId, member] of members) {
        const vs = member.voice;
        const isPotentiallySpeaking = !(vs.selfMute || vs.serverMute || vs.selfDeaf || vs.serverDeaf);
        if (isPotentiallySpeaking) {
          await prisma.eventSessionParticipant.update({
            where: { eventSessionId_userId: { eventSessionId: sessionId, userId: memberId } },
            data: { totalSecondsSpeaking: { increment: SAMPLE_SECONDS }, lastSpeakAt: now },
          });
        }
      }

      // If nobody is connected for multiple consecutive ticks, you may choose to end the session automatically.
      // Skipping auto-end for now; expose a manual /event stop to finalize.

      // Logging to terminal
      const speakingCandidates = Array.from(members.values()).filter(m => {
        const v = m.voice;
        return !(v.selfMute || v.serverMute || v.selfDeaf || v.serverDeaf);
      });

      const prev = prevMembersBySession.get(sessionId) ?? new Set<string>();
      const prevNames = prevMemberNamesBySession.get(sessionId) ?? new Map<string, string>();
      const current = new Set(Array.from(members.keys()));
      const joined: string[] = [];
      const left: string[] = [];
      for (const id of current) if (!prev.has(id)) joined.push(id);
      for (const id of prev) if (!current.has(id)) left.push(id);
      prevMembersBySession.set(sessionId, current);
      // Build current names map for next tick
      const currentNames = new Map<string, string>();
      for (const [id, m] of members) currentNames.set(id, m.displayName || m.user?.username || id);
      prevMemberNamesBySession.set(sessionId, currentNames);

      const chanName = (vc as any).name ?? vcId;
      console.log(
        `[EventTrack] ${now.toISOString()} | session ${sessionId} | #${chanName} | members:${members.size} | talk-ish:${speakingCandidates.length}`
      );
      if (joined.length || left.length) {
        if (joined.length) {
          const joinedPretty = joined.map(id => {
            const m = members.get(id);
            return m ? `${m.displayName} (${id})` : id;
          }).join(", ");
          console.log(`  + joined: ${joinedPretty}`);
        }
        if (left.length) {
          const leftPretty = left.map(id => {
            // Prefer previous tick's known display name; fallback to guild cache; else id
            const name = prevNames.get(id) || (vc.guild.members.cache.get(id)?.displayName) || id;
            return `${name} (${id})`;
          }).join(", ");
          console.log(`  - left: ${leftPretty}`);
        }
      }
      if (VERBOSE && members.size) {
        for (const m of members.values()) {
          const v = m.voice;
          const flags = [
            v.selfMute ? "selfMute" : null,
            v.serverMute ? "serverMute" : null,
            v.selfDeaf ? "selfDeaf" : null,
            v.serverDeaf ? "serverDeaf" : null,
          ].filter(Boolean);
          console.log(`    - ${m.displayName} (${m.id}) ${flags.length ? `[${flags.join(", ")}]` : "[open]"}`);
        }
      }

    } catch (err) {
      // Stop tracker if session was deleted or serious errors occur
      console.error("[EventTrack] Session tracker error", err);
    }
  };

  // Run immediately then on interval
  console.log(`[EventTrack] Starting session tracker ${sessionId} for guild ${guildId}, channel ${vcId}; sample=${SAMPLE_SECONDS}s.`);
  await tick();
  const timer = setInterval(tick, SAMPLE_SECONDS * 1000);
  activeTimers.set(sessionId, timer);
}

export function stopSessionTracker(sessionId: number) {
  const t = activeTimers.get(sessionId);
  if (t) {
    clearInterval(t);
    activeTimers.delete(sessionId);
    prevMembersBySession.delete(sessionId);
    console.log(`[EventTrack] Stopped session tracker ${sessionId}.`);
  }
}
