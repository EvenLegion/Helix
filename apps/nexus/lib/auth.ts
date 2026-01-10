import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@workspace/db";
import { ac, owner, adminRole, moderator, user } from "@/lib/auth/permissions";
import { getActiveOrganizationInternal } from "@/server/organizations";

interface Account {
    id: string;
    providerId: string;
    accountId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    accessToken?: string | null;
    refreshToken?: string | null;
    scope?: string | null;
    idToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    refreshTokenExpiresAt?: Date | null;
    password?: string | null;
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    session: {
        // Session Lifespan: 30 days
        expiresIn: 60 * 60 * 24 * 30,

        // Refresh session after 1 day of activity,
        refreshAfter: 60 * 60 * 24,

        // Require fresh login (< 5 minutes) for sensitive actions
        freshAge: 60 * 5,

        // Enable cookie caching for reduce DB load
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
            stategy: "compact",
            refreshCache: true, // Auto-refresh at 4 minutes
        },
    },
    emailAndPassword: {
        enabled: false,
    },
    plugins: [
        organization({
            ac,
            roles: {
                owner,
            },
            dynamicAccessControl: {
                enabled: true,
            },
        }),
        admin({
            ac,
            roles: {
                admin: adminRole,
                moderator,
                user
            },
            adminRoles: ['admin'], // Users with role='admin' can use all admin features
        }),
        nextCookies(),
    ],
    user: {
        additionalFields: {
            username: {
                type: "string",
                required: false,
            },
            nickname: {
                type: "string",
                required: false,
            }
        }
    },
    socialProviders: {
        discord: {
            clientId: process.env.AUTH_DISCORD_ID as string,
            clientSecret: process.env.AUTH_DISCORD_SECRET as string,
            scope: ["identify", "email", "guilds", "guilds.members.read", "guilds.join"],
            prompt: "consent",
            mapProfileToUser: async (profile) => {
                console.log('Discord profile:', profile);
                const discordId = profile.id;

                // Try to find existing-user with Discord ID
                const existingUser = await prisma.user.findUnique({
                    where: { id: discordId },
                    include: { accounts: true }
                });

                if (existingUser) {
                    console.log('Found existing user:', existingUser.id);

                    // Update user data from Discord profile
                    const updatedUser = await prisma.user.update({
                        where: { id: discordId },
                        data: {
                            username: profile.username,
                            name: profile.global_name || profile.username,
                            email: profile.email,
                            image: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : null,
                            emailVerified: profile.verified || existingUser.emailVerified
                        }
                    });

                    return {
                        id: updatedUser.id,
                        username: profile.username,
                        name: profile.global_name || profile.username,
                        email: profile.email,
                        image: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : undefined
                    };
                } else {
                    console.log('Creating new user with Discord ID:', discordId);
                    const newUser = await prisma.user.create({
                        data: {
                            id: discordId,
                            username: profile.username,
                            name: profile.global_name || profile.username,
                            email: profile.email,
                            image: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : null,
                            emailVerified: profile.verified || false
                        }
                    });

                    return {
                        id: newUser.id,
                        username: profile.username,
                        name: profile.global_name || profile.username,
                        email: profile.email,
                        image: profile.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar}.png` : undefined
                    };
                }
            }
        },
    },
    databaseHooks: {
        account: {
            create: {
                after: async (account) => {
                    await updateUserData(account);
                }
            },
            update: {
                after: async (account) => {
                    await updateUserData(account);
                }
            }
        },
        session: {
            create: {
                before: async (session) => {
                    const organization = await getActiveOrganizationInternal(session.userId);
                    return {
                        data: {
                            ...session,
                            activeOrganizationId: organization?.id ?? null,
                        }
                    }
                }
            }
        }
    }
});

async function updateUserData(account: Account) {
    if (account.providerId === 'discord' && account.accessToken) {
        try {
            const guildId = process.env.GUILD_ID;

            // Add user to guild if not already a member
            if (guildId) {
                await addUserToGuild({
                    guildId,
                    userId: account.accountId,
                    accessToken: account.accessToken,
                });
            }


            const response = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            const memberData = await response.json();
            console.log('Member data:', memberData);

            await prisma.user.update({
                where: {
                    id: account.userId,
                },
                data: {
                    nickname: memberData.nick,
                    username: memberData.username,
                    email: memberData.email,
                }
            });

        } catch (error) {
            console.error('Error fetching guild:', error);
        }
    } else {
        console.log('No guild ID or access token found for Discord provider.');
    }
}

async function addUserToGuild(params: { guildId: string; userId: string; accessToken: string; }) {
    const { guildId, userId, accessToken } = params;

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) throw new Error('Discord bot token not configured.');

    const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            access_token: accessToken,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to add user to guild: ${errorData.message}`);
    }
}
