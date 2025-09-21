import { ChannelType, StageChannel, VoiceChannel, PermissionsBitField } from "discord.js";

const CLEANUP_INTERVAL_MS = 10_000; // 10s
const CLEANUP_TTL_MS = 30 * 60_000; // 30 minutes safety window

const activeCleanups = new Map<string, NodeJS.Timeout>(); // by channelId

export function startChannelCleanupWatcher(client: any, guildId: string, channelId: string) {
  const key = channelId;
  if (activeCleanups.has(key)) return; // already watching

  const startedAt = Date.now();

  const tick = async () => {
    try {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
      const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        stopChannelCleanupWatcher(channelId);
        return;
      }
      if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
        // Not a voice-like channel anymore; stop watching
        stopChannelCleanupWatcher(channelId);
        return;
      }

      const vc = channel as VoiceChannel | StageChannel;
      // Ensure we can observe members in this channel
      const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
      if (!me || !me.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
        // Lacking visibility — stop; we won't try deleting blindly
        stopChannelCleanupWatcher(channelId);
        return;
      }

      const membersCount = vc.members?.size ?? 0;
      if (membersCount === 0) {
        // Try to delete; swallow permission issues with a log
        try {
          await vc.delete("Event ended: bot-created channel cleanup (empty)");
          console.log(`[EventTrack] Deleted empty channel ${channelId}.`);
        } catch (e) {
          console.warn(`[EventTrack] Failed to delete channel ${channelId}:`, e);
        }
        stopChannelCleanupWatcher(channelId);
        return;
      }

      // TTL guard — stop watching after window
      if (Date.now() - startedAt > CLEANUP_TTL_MS) {
        console.log(`[EventTrack] Cleanup watcher TTL reached for channel ${channelId}, stopping.`);
        stopChannelCleanupWatcher(channelId);
      }
    } catch (e) {
      console.warn("[EventTrack] Cleanup watcher tick error", e);
    }
  };

  // Run immediately then on interval
  tick();
  const timer = setInterval(tick, CLEANUP_INTERVAL_MS);
  activeCleanups.set(key, timer);
}

export function stopChannelCleanupWatcher(channelId: string) {
  const t = activeCleanups.get(channelId);
  if (t) {
    clearInterval(t);
    activeCleanups.delete(channelId);
  }
}
