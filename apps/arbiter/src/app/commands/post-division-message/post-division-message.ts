import type { ChatInputCommandContext, CommandData } from "commandkit";
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	type TextChannel,
	type Guild,
} from "discord.js";
import { forInteraction } from "@workspace/logger";
import { Division, prisma } from "@workspace/db";

import { CONFIG, DIVISION_ROLES } from "../../config";

type DivisionWithEmoji = Division & { emojiId: string; emojiName: string };

const COMBAT_DESCRIPTIONS: Record<string, string[]> = {
	HLO: [
		"**High-Altitude Lethal Overwatch** - H.A.L.O. is Even Legion's elite fighter squadron. These pilots dominate the skies through fierce engagement and superior air control, ensuring aerial superiority in every conflict.",
		"\nIn this Division, you might: fly high-speed fighters/interceptors, engage enemy squadrons, or serve as air cover in coordinated ops.",
	],
	VNG: [
		"**Vehicle & Ground Unity Armed Deployment** - V.A.N.G.U.A.R.D. is the Legion's ground combat core. Vanguard leads bunker breaches, vehicle assaults, and frontline raids. Whether it's boots in the dirt or tanks on the move, they're our hammer on the ground.",
		"\nIn this Division, you might: clear bunkers, operate tanks or transports, hold fortified positions, and assault, clear, and hold key locations.",
	],
	HVK: [
		"**Heavy Air Support & Variable Ordnance** - H.A.V.O.K. is our multi-crew gunship and heavy-class strike unit. Operating between air and ground, they bring firepower and flexibility to escort, overwatch, and support combat teams in hostile zones.",
		"\nIn this Division, you might: crew a gunship, escort dropships, take out enemy capital ships, or support divisions on the ground and in the air.",
	],
};

const INDUSTRIAL_DESCRIPTIONS: Record<string, string[]> = {
	DRL: [
		"**Deep Resource & Industrial Legion Logistics** - D.R.I.L.L keeps the Legion supplied with raw materials — Quantanium, Laranite, Bexalite, and everything in between. From ROC teams to Mole crews, these operators extract resources and manage refining to maximize profit.",
	],
	SCR: [
		"**Salvage, Collection, Recovery & Processing** - S.C.R.A.P. reclaims value from the wreckage of war. Whether it's scraping hulls in a Vulture, stripping down derelicts, or hauling back cargo left behind, this Division thrives on turning trash into treasure.",
	],
	LOG: [
		"**Logistics, Organization, Ground & Interstellar** - L.O.G.I. is the beating heart of organization in the Legion. They transport objectives, cargo, and mission-critical equipment across planets and systems.",
	],
	TRD: [
		"**Trade, Routes, Acquisition, Distribution & Exchange** - T.R.A.D.E. plays the markets. These pilots know where to buy, where to sell, and how to make credits flow. From high-risk cargo routes to market-savvy exports, T.R.A.D.E. members fly for profit, planning every move for maximum gain.",
	],
	ARC: [
		"**Advanced Research, Construction & Habilitation** - A.R.C.H. builds the future. Focused on repair, engineering, refuel, infrastructure, and crafting systems as they develop, this Division is for tinkerers, mechanics, and future builders.",
	],
};

export const command: CommandData = {
	name: "post-division-message",
	description: "Post division selection message with buttons",
	dm_permission: false,
	options: [
		{
			name: "type",
			description: "Combat or Industrial divisions",
			type: ApplicationCommandOptionType.String,
			required: true,
			choices: [
				{ name: "Combat", value: "combat" },
				{ name: "Industrial", value: "industrial" },
			],
		},
	],
};

export async function chatInput({ interaction }: ChatInputCommandContext) {
	const log = forInteraction(interaction).child({ mod: "post-division-message" });

	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!interaction.inGuild() || !interaction.guild) {
			return interaction.editReply({
				content: "This command can only be used in a server.",
			});
		}

		const divisionType = interaction.options.getString("type", true) as "combat" | "industrial";

		const divisions = await fetchDivisionsWithEmojis(divisionType);

		if (divisions.length === 0) {
			log.warn("No divisions with emojis found in database. Please seed divisions first.");
			return interaction.editReply({
				content: "No divisions with emojis found in database. Please seed divisions first.",
			});
		}

		const embed = buildDivisionEmbed(divisionType, divisions, interaction.guild as unknown as Guild);
		const buttons = createDivisionButtons(divisionType, divisions);
		const rows = organizeButtonsIntoRows(buttons);

		const message = await (interaction.channel as unknown as TextChannel).send({
			embeds: [embed],
			components: rows,
		});

		log.info(
			{ messageId: message.id, channelId: message.channelId, divisionType },
			"Posted division selection message"
		);

		return interaction.editReply({
			content: `${divisionType === "combat" ? "Combat" : "Industrial"} division message posted successfully!`,
		});
	} catch (error: unknown) {
		log.error({ err: error }, "Failed to post division message");
		const errorMessage =
			error instanceof Error
				? error.message
				: typeof error === "string"
					? error
					: "An unknown error occurred";
		return interaction.editReply({
			content: `Failed to post message: ${errorMessage}`,
		});
	}
}

/**
 * Fetches divisions of the specified type that have emoji data
 */
async function fetchDivisionsWithEmojis(
	divisionType: "combat" | "industrial"
): Promise<DivisionWithEmoji[]> {
	const allowedCodes =
		divisionType === "combat"
			? Object.keys(DIVISION_ROLES.combat)
			: Object.keys(DIVISION_ROLES.industrial);

	return (await prisma.division.findMany({
		where: {
			kind: { equals: divisionType, mode: "insensitive" },
			code: { in: allowedCodes },
			AND: [{ emojiId: { not: null } }, { emojiName: { not: null } }],
		},
		orderBy: { id: "asc" },
	})) as DivisionWithEmoji[];
}

/**
 * Adds division description fields to the embed
 */
function addDivisionFields(
	embed: EmbedBuilder,
	divisions: DivisionWithEmoji[],
	descriptions: Record<string, string[]>
): void {
	for (const division of divisions) {
		const emoji = `<:${division.emojiName}:${division.emojiId}>`;
		const desc = descriptions[division.code]?.join("\n") || "";
		embed.addFields({
			name: `${emoji} **Division: ${division.name}**`,
			value: desc,
			inline: false,
		});
		embed.addFields({
			name: "\u200B", // Empty field to separate divisions
			value: "",
			inline: false,
		});
	}
}

/**
 * Adds footer instructions to the embed
 */
function addFooterInstructions(embed: EmbedBuilder, divisionType: "combat" | "industrial"): void {
	const instructions = [
		"✅ Click a division button to join your division.",
		"",
		"🔄 Click a different division button to switch divisions.",
		"",
	];

	instructions.push(`❌ Click the _Leave Division_ button to leave your ${divisionType} division.`);

	if (divisionType === "combat") {
		instructions.push("");
		instructions.push("ℹ️ Click the _View Uniforms_ button to view approved Legion armor sets.");
	}

	embed.addFields({
		name: "\u200B", // Empty field to separate footer
		value: instructions.join("\n"),
		inline: false,
	});
}

/**
 * Builds the complete division selection embed
 */
function buildDivisionEmbed(
	divisionType: "combat" | "industrial",
	divisions: DivisionWithEmoji[],
	guild: Guild
): EmbedBuilder {
	// Find the Legionnaire role (required to exist)
	const legionnaireRole = guild.roles.cache.get(CONFIG.LEGIONNAIRE_ROLE_ID);
	if (!legionnaireRole) {
		throw new Error("Legionnaire role not found in server");
	}

	const embed = new EmbedBuilder()
		.setTitle(
			divisionType === "combat"
				? "🎖️ SELECT YOUR COMBAT DIVISION"
				: "⚙️ SELECT YOUR INDUSTRIAL DIVISION"
		)
		.setDescription(
			`_Only <@&${legionnaireRole.id}> may select. You may choose **ONE** ${divisionType} division._\n\n`
		)
		.setColor(0xfb4646);

	// Add initial spacer
	embed.addFields({
		name: "\u200B",
		value: "",
		inline: false,
	});

	// Add division descriptions
	const descriptions = divisionType === "combat" ? COMBAT_DESCRIPTIONS : INDUSTRIAL_DESCRIPTIONS;
	addDivisionFields(embed, divisions, descriptions);

	// Add footer instructions
	addFooterInstructions(embed, divisionType);

	return embed;
}

/**
 * Creates button components for division selection
 */
function createDivisionButtons(
	divisionType: "combat" | "industrial",
	divisions: DivisionWithEmoji[]
): ButtonBuilder[] {
	const buttons = divisions.map((div) =>
		new ButtonBuilder()
			.setCustomId(`division:${divisionType}:${div.code}`)
			.setLabel(div.name)
			.setStyle(ButtonStyle.Primary)
			.setEmoji({ id: div.emojiId })
	);

	// Add "Leave Division" button
	buttons.push(
		new ButtonBuilder()
			.setCustomId(`division:${divisionType}:LEAVE`)
			.setLabel("Leave Division")
			.setStyle(ButtonStyle.Danger)
	);

	buttons.push(
		new ButtonBuilder()
			.setLabel("View Uniforms")
			.setStyle(ButtonStyle.Link)
			.setURL("https://www.evenlegion.space/uniforms")
			.setEmoji("ℹ️")
	);

	return buttons;
}

/**
 * Organizes buttons into rows (max 5 buttons per row)
 */
function organizeButtonsIntoRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];
	for (let i = 0; i < buttons.length; i += 5) {
		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
	}
	return rows;
}
