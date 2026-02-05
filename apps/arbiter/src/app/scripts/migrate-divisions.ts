import { Client, GatewayIntentBits } from "discord.js";
import { prisma } from "@workspace/db";

import { syncNicknameAuto } from "../services/rankSync.ts";

type DivisionCode = "SPR" | "RFT" | "HLO" | "VNG";

type MigrationSpec = {
	from: DivisionCode;
	to: DivisionCode;
};

// Map legacy divisions to their new targets.
const MIGRATIONS: MigrationSpec[] = [
	{ from: "SPR", to: "HLO" },
	{ from: "RFT", to: "VNG" },
];

const argv = process.argv.slice(2);
const hasFlag = (flag: string) => argv.includes(flag);
const dryRun = hasFlag("--dry-run");


const env = (process.env.ENVIRONMENT || process.env.NODE_ENV || "production").toLowerCase();
const isDev = ["dev", "development", "local"].includes(env);

const DISCORD_TOKEN =
	process.env.DISCORD_TOKEN ||
	process.env.BOT_TOKEN ||
	process.env.TOKEN ||
	"";
const GUILD_ID =
	process.env.DISCORD_GUILD_ID ||
	process.env.GUILD_ID ||
	"";

const PROD_ROLE_IDS: Record<DivisionCode, string> = {
	HLO: "1356438908212088863",
	VNG: "1356438093988757686",
	SPR: "1356438285592825989",
	RFT: "1356438213438472323",
};

const DEV_ROLE_IDS: Record<DivisionCode, string> = {
	HLO: process.env.DEV_HALO_ROLE_ID ?? "",
	VNG: process.env.DEV_VANGUARD_ROLE_ID ?? "",
	SPR: process.env.DEV_SPEAR_ROLE_ID ?? "",
	RFT: process.env.DEV_RAFT_ROLE_ID ?? "",
};

const ROLE_IDS = isDev ? DEV_ROLE_IDS : PROD_ROLE_IDS;

function requireRoleId(code: DivisionCode): string {
	const id = ROLE_IDS[code];
	if (!id) {
		throw new Error(
			`Missing role ID for ${code}. Set ${isDev ? "DEV_*_ROLE_ID" : "production role IDs"} before running.`
		);
	}
	return id;
}

/**
 * Step 1: Update divisionMemberships in the DB.
 * - Remove duplicate legacy memberships where target already exists.
 * - Move remaining legacy memberships to target divisions.
 * - Validate no legacy memberships remain.
 */
async function migrateMemberships() {
	console.log(`=== Migrating Memberships ===`);

	const codes: DivisionCode[] = ["SPR", "RFT", "HLO", "VNG"];
	const divisions = await prisma.division.findMany({ where: { code: { in: codes } } });
	const byCode = new Map(divisions.map((d) => [d.code as DivisionCode, d]));

	for (const code of codes) {
		if (!byCode.has(code)) {
			throw new Error(`Division ${code} not found in DB. Aborting.`);
		}
	}

	const affectedUsers = new Map<DivisionCode, Set<string>>();

	for (const { from, to } of MIGRATIONS) {
		const fromDiv = byCode.get(from)!;
		const toDiv = byCode.get(to)!;

		// Current memberships for legacy division
		const fromMemberships = await prisma.divisionMembership.findMany({
			where: { divisionId: fromDiv.id },
			select: { userId: true },
		});
		// Current memberships for target division
		const toMemberships = await prisma.divisionMembership.findMany({
			where: { divisionId: toDiv.id },
			select: { userId: true },
		});

		const toSet = new Set(toMemberships.map((m) => m.userId));
		// Users already in target division; drop legacy membership
		const duplicates = fromMemberships.filter((m) => toSet.has(m.userId));
		// Users only in legacy division; move to target division
		const toMove = fromMemberships.filter((m) => !toSet.has(m.userId));

		affectedUsers.set(from, new Set(fromMemberships.map((m) => m.userId)));

		console.log(
			`${from} -> ${to}: total=${fromMemberships.length} ` +
			`duplicates=${duplicates.length} toMove=${toMove.length}`
		);

		if (dryRun) {
			continue;
		}

		if (duplicates.length > 0) {
			// Remove duplicate legacy memberships
			await prisma.divisionMembership.deleteMany({
				where: {
					divisionId: fromDiv.id,
					userId: { in: duplicates.map((m) => m.userId) },
				},
			});
		}

		if (toMove.length > 0) {
			// Repoint legacy memberships to target division
			await prisma.divisionMembership.updateMany({
				where: {
					divisionId: fromDiv.id,
					userId: { in: toMove.map((m) => m.userId) },
				},
				data: {
					divisionId: toDiv.id,
					lastComputedAt: new Date(),
				},
			});
		}
	}

	if (dryRun) {
		return { affectedUsers };
	}

	// Verify legacy memberships are cleared before cleanup.
	for (const { from } of MIGRATIONS) {
		const div = byCode.get(from)!;
		const remaining = await prisma.divisionMembership.count({ where: { divisionId: div.id } });
		if (remaining > 0) {
			throw new Error(
				`Validation failed: ${remaining} memberships still reference ${from}. Aborting cleanup.`
			);
		}
	}

	return { affectedUsers };
}

/**
 * Step 2: Swap Discord roles and sync nicknames for affected users.
 */
async function updateDiscordAndNicknames(
	client: Client,
	guildId: string,
	affectedUsers: Map<DivisionCode, Set<string>>
) {
	console.log(`=== Migrating Discord Roles + Nickname Sync ===`);

	const guild = await client.guilds.fetch(guildId);

	for (const { from, to } of MIGRATIONS) {
		const fromRoleId = requireRoleId(from);
		const toRoleId = requireRoleId(to);
		const users = Array.from(affectedUsers.get(from) ?? []);
		let missing = 0;
		let addCount = 0;
		let removeCount = 0;
		let syncCount = 0;

		for (const userId of users) {
			const member = await guild.members.fetch(userId).catch(() => null);
			if (!member) {
				missing++;
				continue;
			}

			const hasFrom = member.roles.cache.has(fromRoleId);
			const hasTo = member.roles.cache.has(toRoleId);

			if (hasFrom) removeCount++;
			if (!hasTo) addCount++;

			if (!dryRun) {
				// Remove legacy role, add target role, then sync nickname
				if (hasFrom) {
					try {
						await member.roles.remove(fromRoleId);
					} catch (err) {
						console.warn(`[roles] failed to remove ${from} from ${userId}: ${String((err as any)?.message ?? err)}`);
					}
				}
				if (!hasTo) {
					try {
						await member.roles.add(toRoleId);
					} catch (err) {
						console.warn(`[roles] failed to add ${to} to ${userId}: ${String((err as any)?.message ?? err)}`);
					}
				}
				try {
					await syncNicknameAuto({ guild, userID: userId });
				} catch (err) {
					console.warn(`[nickname] failed for ${userId}: ${String((err as any)?.message ?? err)}`);
				}
			}

			syncCount++;
		}

		console.log(
			`${from} -> ${to}: users=${users.length} add=${addCount} remove=${removeCount} ` +
			`missing=${missing} nickSync=${syncCount}`
		);
	}
}

/**
 * Step 3: Delete SPR/RFT from the division table once memberships are cleared.
 */
async function deleteLegacyDivisions() {
	console.log(`=== Deleting Legacy Divisions ===`);

	if (dryRun) {
		console.log("Dry run: skipping division deletion.");
		return;
	}

	const codes: DivisionCode[] = ["SPR", "RFT"];
	const remaining = await prisma.divisionMembership.count({
		where: { division: { code: { in: codes } } },
	});
	if (remaining > 0) {
		throw new Error(
			`Refusing to delete divisions; ${remaining} memberships still reference SPR/RFT.`
		);
	}

	const deleted = await prisma.division.deleteMany({ where: { code: { in: codes } } });
	console.log(`Deleted ${deleted.count} legacy divisions.`);
}

/**
 * Orchestrates the migration:
 * 1) DB membership updates
 * 2) Discord role swap + nickname sync
 * 3) Legacy division cleanup
 */
async function main() {
	console.log(`Division migration ${dryRun ? "(dry-run)" : "(live)"} env=${env}`);

	if (!dryRun && (!DISCORD_TOKEN || !GUILD_ID)) {
		throw new Error("DISCORD_TOKEN and DISCORD_GUILD_ID (or GUILD_ID) are required.");
	}

	const { affectedUsers } = await migrateMemberships();

	let client: Client | null = null;
	try {
		if (DISCORD_TOKEN && GUILD_ID) {
			client = new Client({
				intents: [
					GatewayIntentBits.Guilds,
					GatewayIntentBits.GuildMembers,
				],
			});

			await client.login(DISCORD_TOKEN);
			await updateDiscordAndNicknames(client, GUILD_ID, affectedUsers);
			await deleteLegacyDivisions();
		} else {
			console.log("Discord env not set; skipping role updates and nickname sync.");
		}
	} finally {
		if (client) {
			await client.destroy();
		}
	}
}

main()
	.then(() => {
		console.log("Done.");
	})
	.catch(async (err) => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
