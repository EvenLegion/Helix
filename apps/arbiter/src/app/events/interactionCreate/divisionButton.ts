import type { ButtonInteraction, Client } from "discord.js";
import { childLogger } from "@workspace/logger";
import { ensureUsersByIds } from "../../utils/ensureUsers";
import { joinDivision, leaveDivision } from "../../services/divisionManager";

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
 */
async function handleLeaveDivision(interaction: ButtonInteraction, divisionKind: string) {
	if (!interaction.guild) {
		await interaction.editReply({
			content: "❌ This command can only be used in a server.",
		});
		return;
	}

	const result = await leaveDivision({
		guild: interaction.guild,
		userId: interaction.user.id,
		divisionKind,
	});

	if (!result.success) {
		await interaction.editReply({
			content: `❌ Failed to leave division: ${result.error}`,
		});
		return;
	}

	if (result.wasNotMember) {
		// User doesn't have any division of this kind to leave
		await interaction.editReply({
			content: `ℹ️ You don't have any ${divisionKind} division to leave.`,
		});
		return;
	}

	const leaveMessage =
		divisionKind === "combat"
			? `✅ You've left your combat division. Your nickname has been updated.`
			: `✅ You've left your industrial division. Your nickname has been updated.`;

	await interaction.editReply({
		content: leaveMessage,
	});
}

/**
 * Handles joining a specific division
 */
async function handleJoinDivision(
	interaction: ButtonInteraction,
	divisionKind: string,
	divisionCode: string
) {
	if (!interaction.guild) {
		await interaction.editReply({
			content: "❌ This command can only be used in a server.",
		});
		return;
	}

	const result = await joinDivision({
		guild: interaction.guild,
		userId: interaction.user.id,
		divisionCode,
		divisionKind,
	});

	if (!result.success) {
		await interaction.editReply({
			content: result.error || "❌ Failed to join division. Please contact staff.",
		});
		return;
	}

	// User already has this division
	if (result.alreadyMember && result.division) {
		// Use proper grammar: "You're already Legionnaire" vs "You're already in H.A.L.O."
		const message =
			result.division.code === "LGN"
				? `✅ You're already **${result.division.name}**!`
				: `✅ You're already in **${result.division.name}**!`;

		await interaction.editReply({ content: message });
		return;
	}

	// Successfully joined division
	if (result.division) {
		const message = buildSuccessMessage(result.division.name, divisionKind);
		await interaction.editReply({ content: message });
	}
}

/**
 * Builds the success message based on division type
 * Note: Nickname priority is combat > industrial > LGN
 */
function buildSuccessMessage(divisionName: string, divisionKind: string): string {
	const isCombat = divisionKind === "combat";
	const isIndustrial = divisionKind === "industrial";

	if (isCombat) {
		return `✅ You've joined **${divisionName}**! Your nickname has been updated to show your combat division.`;
	} else if (isIndustrial) {
		return `✅ You've joined **${divisionName}**! Your nickname will show this division if you don't have a combat division.`;
	} else {
		// General division (LGN)
		return `✅ You've joined **${divisionName}**!`;
	}
}
