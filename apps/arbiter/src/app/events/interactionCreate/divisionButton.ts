import type { ButtonInteraction, Client, Guild } from "discord.js";
import { prisma, Division } from "@workspace/db";
import { childLogger } from "@workspace/logger";
import { syncNicknameForDivision } from "../../services/rankSync";
import { ensureUsersByIds } from "../../utils/ensureUsers";

const log = childLogger({ mod: "divisionButton", event: "interactionCreate" });

/**
 * Handles division selection button clicks
 *
 * CustomId format: "division:{kind}:{code}"
 * - Examples: "division:combat:HLO", "division:industrial:DRL", "division:combat:LGN"
 * - Special: "division:industrial:LEAVE" for industrial leave button
 *
 * Division Rules:
 * - Combat: Users must have exactly ONE combat division (default: LGN)
 * - Industrial: Users can have ZERO or ONE industrial division
 * - Only combat divisions show in nickname (showRank: true)
 *
 * Database Strategy:
 * We use deleteMany + create instead of update because divisionId is part of the
 * composite unique key (userId, divisionId). Switching divisions means creating a
 * new row with a different divisionId, not updating the existing row.
 *
 * LGN Special Handling:
 * LGN is kind="general" but acts as the default combat division. It bypasses
 * kind validation and is included in combat division queries.
 */
export default async function (interaction: ButtonInteraction, client: Client) {
	if (!interaction.isButton()) return;
	if (!interaction.customId.startsWith("division:")) return;

	const [_, divisionKind, divisionCode] = interaction.customId.split(":");

	if (!divisionKind || !divisionCode) {
		log.warn({ customId: interaction.customId }, "Invalid division button customId format");
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	log.info(
		{ userId: interaction.user.id, divisionKind, divisionCode },
		"Processing division button click"
	);

	try {
		await ensureUsersByIds([interaction.user.id], "divisionButton");

		// Handle the special "LEAVE" action
		if (divisionCode === "LEAVE") {
			await handleLeaveDivision(interaction, divisionKind);
			return;
		}

		// Handle joining a specific division
		await handleJoinDivision(interaction, divisionKind, divisionCode);
	} catch (error: any) {
		log.error(
			{ err: error, userId: interaction.user.id, divisionKind, divisionCode },
			"Error processing division button"
		);
		const errorMessage =
			error instanceof Error ? error.message : String(error ?? "Unknown error");
		await interaction.editReply({
			content: `❌ Failed to update your division: ${errorMessage}`,
		});
	}
}

/**
 * Handles the "Leave Division" button click
 * - Combat: Returns user to LGN
 * - Industrial: Removes industrial division
 */
async function handleLeaveDivision(interaction: ButtonInteraction, divisionKind: string) {
	const divisionIds = await getSamekindDivisionIds(divisionKind);

	const result = await prisma.divisionMembership.deleteMany({
		where: {
			userId: interaction.user.id,
			divisionId: { in: divisionIds },
		},
	});

	if (result.count === 0) {
		await handleNoDivisionToLeave(interaction, divisionKind);
		return;
	}

	log.info(
		{ userId: interaction.user.id, divisionKind, removedCount: result.count },
		"User left division"
	);

	// Sync nickname back to LGN for combat divisions
	if (interaction.guild && divisionKind === "combat") {
		await syncNicknameAfterLeavingCombat(interaction.guild, interaction.user.id);
	}

	await interaction.editReply({
		content: `✅ You've left your ${divisionKind} division.`,
	});
}

/**
 * Handles when a user tries to leave but has no division of that kind
 */
async function handleNoDivisionToLeave(interaction: ButtonInteraction, divisionKind: string) {
	if (divisionKind === "combat") {
		// Error: All users should have a combat division (at least LGN)
		log.error({ userId: interaction.user.id }, "User has no combat division to leave");
		await interaction.editReply({
			content: `❌ Error: You don't have a combat division. Please contact staff.`,
		});
	} else {
		// Normal: Industrial divisions are optional
		log.info({ userId: interaction.user.id }, "User has no industrial division to leave");
		await interaction.editReply({
			content: `ℹ️ You don't have any industrial division to leave.`,
		});
	}
}

/**
 * Handles joining a specific division
 */
async function handleJoinDivision(
	interaction: ButtonInteraction,
	divisionKind: string,
	divisionCode: string
) {
	const division = await findAndValidateDivision(divisionCode, divisionKind);

	if (!division) {
		log.error({ divisionCode }, "Division not found in database");
		await interaction.editReply({
			content: "❌ Division not found. Please contact staff.",
		});
		return;
	}

	const divisionIds = await getSamekindDivisionIds(divisionKind);

	// Check if user already has this division
	if (await userAlreadyHasOnlyThisDivision(interaction.user.id, division.id, divisionIds)) {
		await handleAlreadyInDivision(interaction, division);
		return;
	}

	// Switch to the new division
	await switchDivision(interaction.user.id, division.id, divisionIds);

	log.info({ userId: interaction.user.id, divisionCode }, "Updated division membership");

	// Sync nickname for combat divisions
	if (interaction.guild) {
		await syncNicknameForCombatDivision(interaction.guild, interaction.user.id, division.code);
	}

	// Send success message
	const message = buildSuccessMessage(division, divisionKind);
	await interaction.editReply({ content: message });
}

/**
 * Finds a division by code and validates it matches the expected kind
 */
async function findAndValidateDivision(
	divisionCode: string,
	expectedKind: string
): Promise<Division | null> {
	const division = await prisma.division.findFirst({
		where: { code: divisionCode },
	});

	if (!division) return null;

	// Validate kind matches (except for LGN which is "general" but used for combat)
	if (division.code !== "LGN" && division.kind.toLowerCase() !== expectedKind.toLowerCase()) {
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
 * For combat divisions, includes LGN (which is kind="general")
 */
async function getSamekindDivisionIds(divisionKind: string): Promise<number[]> {
	const divisions = await prisma.division.findMany({
		where: {
			OR: [
				{ kind: { equals: divisionKind, mode: "insensitive" } },
				// Include LGN for combat divisions since it's the default
				...(divisionKind === "combat" ? [{ code: "LGN" }] : []),
			],
		},
		select: { id: true },
	});

	return divisions.map((d) => d.id);
}

/**
 * Checks if the user has only this specific division (and no others of the same kind)
 */
async function userAlreadyHasOnlyThisDivision(
	userId: string,
	divisionId: number,
	samekindDivisionIds: number[]
): Promise<boolean> {
	const existingMembership = await prisma.divisionMembership.findFirst({
		where: { userId, divisionId },
	});

	if (!existingMembership) return false;

	// Check if they have any other divisions of the same kind
	const otherMemberships = await prisma.divisionMembership.findMany({
		where: {
			userId,
			divisionId: { in: samekindDivisionIds, not: divisionId },
		},
	});

	return otherMemberships.length === 0;
}

/**
 * Handles the case where user is already in the division
 */
async function handleAlreadyInDivision(interaction: ButtonInteraction, division: Division) {
	log.info({ userId: interaction.user.id, divisionCode: division.code }, "User already has this division");

	// Use proper grammar: "You're already Legionnaire" vs "You're already in H.A.L.O."
	const message =
		division.code === "LGN"
			? `✅ You're already **${division.name}**!`
			: `✅ You're already in **${division.name}**!`;

	await interaction.editReply({ content: message });
}

/**
 * Switches user to a new division by deleting old memberships and creating a new one
 */
async function switchDivision(
	userId: string,
	newDivisionId: number,
	samekindDivisionIds: number[]
) {
	// Remove all existing divisions of this kind
	await prisma.divisionMembership.deleteMany({
		where: {
			userId,
			divisionId: { in: samekindDivisionIds },
		},
	});

	// Create membership for the new division
	await prisma.divisionMembership.create({
		data: {
			userId,
			divisionId: newDivisionId,
			lastComputedAt: new Date(),
		},
	});
}

/**
 * Syncs nickname after leaving a combat division (returns to LGN)
 */
async function syncNicknameAfterLeavingCombat(guild: Guild, userId: string) {
	try {
		const result = await syncNicknameForDivision({
			guild,
			userID: userId,
			divisionCode: "LGN",
		});
		log.info({ userId, result }, "Nickname sync completed after leaving");
	} catch (error) {
		log.error({ err: error, userId }, "Failed to sync nickname after leaving");
	}
}

/**
 * Syncs nickname for combat divisions (no-op for industrial since they don't show in nickname)
 */
async function syncNicknameForCombatDivision(guild: Guild, userId: string, divisionCode: string) {
	try {
		const result = await syncNicknameForDivision({
			guild,
			userID: userId,
			divisionCode,
		});
		log.info({ userId, divisionCode, result }, "Nickname sync completed");
	} catch (error) {
		log.error({ err: error, userId, divisionCode }, "Failed to sync nickname");
		// Don't fail the whole operation if nickname sync fails
	}
}

/**
 * Builds the success message based on division type
 */
function buildSuccessMessage(division: Division, divisionKind: string): string {
	const isLGN = division.code === "LGN";
	const isCombat = divisionKind === "combat";

	if (isLGN) {
		return `✅ You've returned to **${division.name}**! Your nickname has been updated.`;
	} else if (isCombat) {
		return `✅ You've joined **${division.name}**! Your nickname has been updated.`;
	} else {
		// Industrial divisions don't show in nickname
		return `✅ You've joined **${division.name}**!`;
	}
}
