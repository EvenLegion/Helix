import type { Guild } from "discord.js";
import { prisma, Division } from "@workspace/db";
import { childLogger } from "@workspace/logger";

import { CONFIG, DIVISION_ROLES } from "../config";
import { syncNicknameAuto } from "./rankSync";

const log = childLogger({ mod: "divisionManager" });

// ============================================================================
// Division Cache
// ============================================================================

let divisionCache: Division[] = [];
let cacheLoadedAt: number | null = null;
let refreshPromise: Promise<void> | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Loads divisions from database into memory cache
 */
export async function refreshDivisionCache(): Promise<void> {
	try {
		divisionCache = await prisma.division.findMany();
		cacheLoadedAt = Date.now();
		log.info({ count: divisionCache.length }, "Division cache loaded");
	} catch (error) {
		log.error({ err: error }, "Failed to load division cache");
		throw error;
	}
}

/**
 * Ensures division cache is loaded and fresh
 * Automatically reloads if cache is null or TTL (24 hours) has expired
 * Uses a promise to prevent multiple concurrent refresh calls (thundering herd)
 */
async function ensureCacheLoaded(): Promise<void> {
	const isCacheExpired = cacheLoadedAt === null || Date.now() - cacheLoadedAt > CACHE_TTL_MS;

	if (!isCacheExpired) return;

	if (!refreshPromise) {
		refreshPromise = refreshDivisionCache().finally(() => {
			refreshPromise = null;
		});
	}

	await refreshPromise;
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface JoinDivisionOptions {
	guild: Guild;
	userId: string;
	divisionCode: string;
	divisionKind: string;
}

export type JoinDivisionResult =
	| {
		success: true;
		division: Division;
		addedRole?: string;
		removedRole?: string;
		alreadyMember: boolean;
	}
	| {
		success: false;
		error: string;
	};

export interface LeaveDivisionOptions {
	guild: Guild;
	userId: string;
	divisionKind: string;
}

export type LeaveDivisionResult =
	| {
		success: true;
		removedRole?: string;
		wasNotMember: boolean;
	}
	| {
		success: false;
		error: string;
	};

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Finds a division by code and validates it matches the expected kind
 * Uses in-memory cache to avoid database queries
 */
async function findAndValidateDivision(
	divisionCode: string,
	expectedKind: string
): Promise<Division | null> {
	await ensureCacheLoaded();

	const division = divisionCache.find((d) => d.code === divisionCode);

	if (!division) return null;

	// Validate kind matches
	if (division.kind.toLowerCase() !== expectedKind.toLowerCase()) {
		log.error(
			{ divisionCode, expectedKind, actualKind: division.kind },
			"Division kind mismatch"
		);
		return null;
	}

	return division;
}

/**
 * Gets all division IDs of the same kind
 * Uses in-memory cache to avoid database queries
 */
async function getSamekindDivisionIds(divisionKind: string): Promise<number[]> {
	await ensureCacheLoaded();

	return divisionCache
		.filter((d) => d.kind.toLowerCase() === divisionKind.toLowerCase())
		.map((d) => d.id);
}

/**
 * Switches user to a division, removing any other divisions of the same kind
 * Users can only have one division per kind (combat/industrial)
 *
 * @returns true if user already had this division, false if they were switched
 */
async function switchDivisionInDatabase(
	userId: string,
	newDivisionId: number,
	samekindDivisionIds: number[]
): Promise<boolean> {
	// Check if user already has this specific division
	const existing = await prisma.divisionMembership.findUnique({
		where: { userId_divisionId: { userId, divisionId: newDivisionId } },
	});

	if (existing) {
		return true; // User already has this division
	}

	// Remove all other divisions of this kind (but not the target division)
	const otherDivisionIds = samekindDivisionIds.filter(id => id !== newDivisionId);
	if (otherDivisionIds.length > 0) {
		await prisma.divisionMembership.deleteMany({
			where: {
				userId,
				divisionId: { in: otherDivisionIds },
			},
		});
	}

	// Create the target division membership
	await prisma.divisionMembership.create({
		data: {
			userId,
			divisionId: newDivisionId,
			lastComputedAt: new Date(),
		},
	});

	return false; // User was switched to new division
}

/**
 * Gets division role IDs for a specific kind
 * @param kind - The division kind (combat/industrial)
 * @param divisionCode - Optional division code to get specific target role
 * @returns Target role ID (if code provided) and all role IDs of the same kind
 */
function getDivisionRolesForKind(
	kind: string,
	divisionCode?: string
): { targetRoleId: string | null; sameKindRoleIds: string[] } {
	const normalizedKind = kind.toLowerCase();

	if (normalizedKind === "combat") {
		const targetRoleId = divisionCode
			? DIVISION_ROLES.combat[divisionCode as keyof typeof DIVISION_ROLES.combat] ?? null
			: null;
		return { targetRoleId, sameKindRoleIds: Object.values(DIVISION_ROLES.combat) };
	}

	if (normalizedKind === "industrial") {
		const targetRoleId = divisionCode
			? DIVISION_ROLES.industrial[divisionCode as keyof typeof DIVISION_ROLES.industrial] ?? null
			: null;
		return { targetRoleId, sameKindRoleIds: Object.values(DIVISION_ROLES.industrial) };
	}

	return { targetRoleId: null, sameKindRoleIds: [] };
}

/**
 * Updates the division role for a user:
 * - If divisionCode is provided: switch to that role (remove old, add new)
 * - If divisionCode is omitted: just remove any existing division role of that kind
 */
async function updateDivisionRole(
	guild: Guild,
	userId: string,
	divisionKind: string,
	divisionCode?: string
): Promise<{ addedRole?: string; removedRole?: string; error?: string }> {
	try {
		const { targetRoleId, sameKindRoleIds } = getDivisionRolesForKind(
			divisionKind,
			divisionCode
		);

		if (divisionCode && !targetRoleId) {
			// Caller asked to assign a specific division, but it's not configured
			return {
				error: `Division ${divisionCode} has no Discord role configured`,
			};
		}

		const member = await guild.members.fetch(userId).catch(() => null);
		if (!member) {
			return {
				error: `Member not found in guild: ${userId}`,
			};
		}

		// Find current division role of this kind (if any)
		const currentRole = sameKindRoleIds.find(
			roleId => roleId !== CONFIG.LEGIONNAIRE_ROLE_ID
				&& roleId !== targetRoleId
				&& member.roles.cache.has(roleId)
		);

		let removedRole: string | undefined;

		if (currentRole) {
			try {
				await member.roles.remove(currentRole);
				removedRole = currentRole;
				log.info({ userId, roleId: currentRole }, "Removed division role");
			} catch (err) {
				log.error({ err, userId, roleId: currentRole }, "Failed to remove division role");
			}
		}

		// If no targetRoleId (no divisionCode), this is a "remove only" call
		if (!targetRoleId) {
			return { removedRole };
		}

		// Add the new division role if user doesn't have it
		if (!member.roles.cache.has(targetRoleId)) {
			await member.roles.add(targetRoleId);
			log.info({ userId, roleId: targetRoleId, divisionCode }, "Added division role");
			return { addedRole: targetRoleId, removedRole };
		}

		return { removedRole };
	} catch (error: any) {
		log.error({ err: error, userId, divisionKind, divisionCode }, "Error updating division role");
		return {
			error: error.message || "Unknown error",
		};
	}
}


// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Joins a user to a division (handles database, roles, and nickname)
 *
 * Business Rules:
 * - LEGIONNAIRE role is NEVER removed (assigned once, kept forever)
 * - Combat divisions: User can have ONE combat division role at a time (replaces existing)
 * - Industrial divisions: User can have ONE industrial division role at a time (replaces existing)
 * - Users can have BOTH one combat AND one industrial role simultaneously
 *
 * @param options - Configuration for joining division
 * @returns Result indicating success, division info, roles changed, or error
 */
export async function joinDivision(
	options: JoinDivisionOptions
): Promise<JoinDivisionResult> {
	const { guild, userId, divisionCode, divisionKind } = options;

	try {
		// 1. Find and validate the division
		const division = await findAndValidateDivision(divisionCode, divisionKind);
		if (!division) {
			log.error({ divisionCode }, "Division not found in database");
			return {
				success: false,
				error: `Division ${divisionCode} not found`,
			};
		}

		// 2. Get all division IDs of this kind
		const divisionIds = await getSamekindDivisionIds(divisionKind);

		// 3. Switch division in database (returns true if user already had it)
		const alreadyHad = await switchDivisionInDatabase(userId, division.id, divisionIds);

		if (alreadyHad) {
			log.info({ userId, divisionCode: division.code }, "User already has this division");
			return {
				success: true,
				division,
				alreadyMember: true,
			};
		}

		log.info({ userId, divisionCode }, "Updated division membership in database");

		// 4. Update Discord role
		const roleResult = await updateDivisionRole(guild, userId, division.kind, division.code);
		if (roleResult.error) {
			log.error({ err: roleResult.error }, "Failed to update division role");
		}

		// 6. Sync nickname using priority logic (combat > industrial > LGN)
		await syncNicknameAuto({ guild, userID: userId });

		return {
			success: true,
			division,
			addedRole: roleResult.addedRole,
			removedRole: roleResult.removedRole,
			alreadyMember: false,
		};
	} catch (error: any) {
		log.error({ err: error, userId, divisionCode }, "Error joining division");
		return {
			success: false,
			error: error.message || "Unknown error",
		};
	}
}

/**
 * Removes a user from their division of a specific kind
 *
 * Business Rules:
 * - NEVER removes the LEGIONNAIRE role (it's permanent)
 * - Removes the combat division role when leaving combat division (user can only have one)
 * - Removes the industrial division role when leaving industrial division (user can only have one)
 * - After leaving, syncs nickname based on priority: combat > industrial > LGN
 *
 * @param options - Configuration for leaving division
 * @returns Result indicating success, removed role, or error
 */
export async function leaveDivision(
	options: LeaveDivisionOptions
): Promise<LeaveDivisionResult> {
	const { guild, userId, divisionKind } = options;

	try {
		// 1. Get all division IDs of this kind
		const divisionIds = await getSamekindDivisionIds(divisionKind);

		// 2. Remove division memberships from database
		const result = await prisma.divisionMembership.deleteMany({
			where: {
				userId,
				divisionId: { in: divisionIds },
			},
		});

		if (result.count === 0) {
			log.info({ userId, divisionKind }, "User has no division to leave");
			return {
				success: true,
				wasNotMember: true,
			};
		}

		log.info(
			{ userId, divisionKind, removedCount: result.count },
			"User left division in database"
		);

		// 3. Remove Discord role (no divisionCode = remove only)
		const roleResult = await updateDivisionRole(guild, userId, divisionKind);
		if (roleResult.error) {
			log.error({ err: roleResult.error }, "Failed to remove division role");
		}

		// 4. Sync nickname using priority logic (combat > industrial > LGN)
		await syncNicknameAuto({ guild, userID: userId });

		return {
			success: true,
			removedRole: roleResult.removedRole,
			wasNotMember: false,
		};
	} catch (error: any) {
		log.error({ err: error, userId, divisionKind }, "Error leaving division");
		return {
			success: false,
			error: error.message || "Unknown error",
		};
	}
}
