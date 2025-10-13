import { GuildMember, User } from "discord.js";
import { prisma } from "@workspace/db";
import { childLogger } from "@workspace/logger";

const log = childLogger({ mod: "ensureUsers" });

/**
 * Ensures a single Discord user exists in the database.
 * Creates a minimal user record if it doesn't exist.
 * 
 * @param discordUser - Discord User or GuildMember object
 * @param context - Optional context for logging (e.g., "sessionTracker", "meritAssignment")
 * @returns Promise<void>
 */
export async function ensureDiscordUser(discordUser: any, context?: string): Promise<void> {
  const user = discordUser instanceof GuildMember ? discordUser.user : discordUser;
  const member = discordUser instanceof GuildMember ? discordUser : null;
  
  const userId = user.id;
  const username = user.username;
  const displayName = member?.displayName ?? user.globalName ?? user.username;
  const nickname = member?.nickname ?? null;
  
  const contextLog = context ? log.child({ context, userId, username }) : log.child({ userId, username });
  
  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        username: username ?? undefined,
        nickname: nickname ?? undefined,
        name: displayName ?? undefined,
        image: user.displayAvatarURL ? user.displayAvatarURL() : undefined,
      },
      create: {
        id: userId,
        username: username ?? null,
        nickname: nickname ?? null,
        name: displayName ?? null,
        image: user.displayAvatarURL ? user.displayAvatarURL() : null,
      },
    });
    
    contextLog.debug("Ensured Discord user exists in database");
  } catch (error) {
    contextLog.error(
      { 
        err: error, 
        userInfo: { 
          id: userId, 
          username, 
          displayName, 
          nickname 
        } 
      }, 
      "Failed to ensure Discord user exists in database"
    );
    throw error;
  }
}

/**
 * Ensures multiple Discord users exist in the database.
 * Creates minimal user records for any that don't exist.
 * 
 * @param discordUsers - Array of Discord User or GuildMember objects
 * @param context - Optional context for logging (e.g., "sessionTracker", "meritAssignment")
 * @returns Promise<void>
 */
export async function ensureDiscordUsers(discordUsers: any[], context?: string): Promise<void> {
  if (!discordUsers.length) return;
  
  const contextLog = context ? log.child({ context, userCount: discordUsers.length }) : log.child({ userCount: discordUsers.length });
  
  try {
    // Process users in batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    for (let i = 0; i < discordUsers.length; i += BATCH_SIZE) {
      const batch = discordUsers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(user => ensureDiscordUser(user, context)));
    }
    
    contextLog.debug("Ensured all Discord users exist in database");
  } catch (error) {
    const userInfos = discordUsers.map(u => {
      const user = u instanceof GuildMember ? u.user : u;
      const member = u instanceof GuildMember ? u : null;
      return {
        id: user.id,
        username: user.username,
        displayName: member?.displayName ?? user.globalName ?? user.username,
        nickname: member?.nickname ?? null,
      };
    });
    
    contextLog.error(
      { 
        err: error, 
        userInfos 
      }, 
      "Failed to ensure Discord users exist in database"
    );
    throw error;
  }
}

/**
 * Ensures users exist by their Discord IDs only (when you don't have the full Discord objects).
 * This creates minimal user records with just the ID.
 * 
 * @param userIds - Array of Discord user ID strings
 * @param context - Optional context for logging
 * @returns Promise<void>
 */
export async function ensureUsersByIds(userIds: string[], context?: string): Promise<void> {
  if (!userIds.length) return;
  
  const contextLog = context ? log.child({ context, userIds }) : log.child({ userIds });
  
  try {
    // Find which users are already in the database
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true }
    });
    
    const existingIds = new Set(existingUsers.map(u => u.id));
    const missingIds = userIds.filter(id => !existingIds.has(id));
    
    if (missingIds.length === 0) {
      contextLog.debug("All users already exist in database");
      return;
    }
    
    // Create minimal user records for missing users
    const createPromises = missingIds.map(id => 
      prisma.user.create({
        data: {
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }).catch(error => {
        // Individual user creation might fail due to race conditions (another process created it)
        // Log the individual failure but don't fail the whole batch
        contextLog.warn({ userId: id, err: error }, "Failed to create individual user (possibly due to race condition)");
      })
    );
    
    await Promise.all(createPromises);
    
    contextLog.info({ 
      totalUsers: userIds.length, 
      existingUsers: existingIds.size, 
      createdUsers: missingIds.length 
    }, "Ensured users exist by IDs");
    
  } catch (error) {
    contextLog.error({ err: error, userIds }, "Failed to ensure users exist by IDs");
    throw error;
  }
}