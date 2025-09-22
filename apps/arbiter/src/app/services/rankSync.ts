import { prisma } from "@workspace/db";
import type { GuildMember } from "discord.js";

const CIRCLED: Record<number, string> = {
	0: "", 1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥", 7: "⑦", 8: "⑧", 9: "⑨",
	10: "⑩", 11: "⑪", 12: "⑫", 13: "⑬", 14: "⑭", 15: "⑮", 16: "⑯", 17: "⑰", 18: "⑱", 19: "⑲"
};

function trackSymbolFor(level: number): string | null {
	if (level >= 40) return "◆";   // Track 40
	if (level >= 30) return "⬖";   // Track 30
	if (level >= 20) return "◇";   // Track 20
	return null;
}

// formatNickname is implemented below after normalization helpers
function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBaseName(baseName: string, divisionPrefix: string | null): string {
	let name = (baseName ?? "").trim();
	// Strip trailing circled digits (existing rank suffix)
	name = name.replace(/\s[\u24ea\u2460-\u2472]\s*$/u, "").trim();
	// Strip leading track symbols
	name = name.replace(/^(?:[\u25c7\u2b16\u25c6]\s*)+/u, ""); // ◇ ⬖ ◆
	// Strip repeated leading division prefix if present
	if (divisionPrefix && divisionPrefix.length) {
		const re = new RegExp(`^(?:${escapeRegExp(divisionPrefix)}\\s*)+`, "i");
		name = name.replace(re, "").trimStart();
	}
	return name;
}

export function formatNickname(baseName: string, divisionPrefix: string | null, level: number, showRank: boolean): string {
	const cleanName = normalizeBaseName(baseName, divisionPrefix);
	let prefix = divisionPrefix ?? "";
	const sym = trackSymbolFor(level);
	if (sym) {
		if (prefix && prefix.includes("|")) {
			const idx = prefix.indexOf("|");
			prefix = `${prefix.slice(0, idx).trimEnd()} ${sym} ${prefix.slice(idx)}`;
		} else if (prefix) {
			prefix = `${prefix.trimEnd()} ${sym} `;
		} else {
			prefix = `${sym} `;
		}
	}
	let decorated = `${prefix}${cleanName}`.replace(/\s{2,}/g, " ").trim();
	if (showRank && level > 0) {
		let circled: string | null = null;
		if (level < 20) {
			circled = CIRCLED[level] ?? `(${level})`;
		} else if (level % 10 !== 0 && level < 40) {
			const sub = level % 10; // 1..9 for 21-29, 31-39
			circled = CIRCLED[sub] ?? `(${sub})`;
		}
		if (circled) decorated = `${decorated} ${circled}`;
	}
	return decorated.slice(0, 32);
}

async function getLevelFromMerits(merits: number): Promise<number> {
	const levels = await prisma.rankLevel.findMany({ orderBy: { level: "asc" } });
	let lvl = 0;
	for (const r of levels) {
		if (merits >= r.cumulativeMerits) lvl = r.level; else break;
	}
	return lvl;
}

export async function computeLevelForUser(userID: string): Promise<{ level: number; merits: number; }> {
	const merit = await prisma.merit.findUnique({ where: { userID }, select: { merits: true } });
	const merits = merit?.merits ?? 0;
	return { level: await getLevelFromMerits(merits), merits };
}

async function pickDisplayDivision(userID: string) {
	const memberships = await prisma.divisionMembership.findMany({ where: { userID }, include: { division: true } });
	const combat = memberships.find(m => m.division.kind === "combat" && m.division.showRank);
	if (combat) return combat.division;
	return await prisma.division.findUnique({ where: { code: "LGN" } });
}

export async function syncNicknameAuto(params: { guild: any; userID: string }) {
	const { guild, userID } = params;
	const division = await pickDisplayDivision(userID);
	if (!division) return { applied: false, reason: "no_division" } as const;

	const { level } = await computeLevelForUser(userID);
	const membership = await prisma.divisionMembership.upsert({
		where: { userID_divisionId: { userID, divisionId: division.id } },
		update: { lastComputedLevel: level, lastComputedAt: new Date() },
		create: { userID, divisionId: division.id, lastComputedLevel: level, lastComputedAt: new Date() },
	});

	if (!division.showRank) {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "in_sync" } });
		return { applied: false, reason: "division_hidden" } as const;
	}

	let member: GuildMember;
	try { member = await guild.members.fetch(userID); }
	catch {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: "Member not in guild" } });
		return { applied: false, reason: "member_not_found" } as const;
	}

	// Base name: preferredName if set in DB, else current display nickname
	let userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
	if (!userRow?.preferredName && (userRow?.nickname?.trim()?.length)) {
		// backfill preferredName from existing nickname once
		await prisma.user.update({ where: { id: userID }, data: { preferredName: userRow!.nickname! } }).catch(() => { });
		userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
	}
	const baseName = (userRow?.preferredName?.trim()?.length ? userRow!.preferredName! : (member.nickname ?? member.displayName));
	const before = member.nickname ?? member.displayName;
	const after = formatNickname(baseName, division.nicknamePrefix ?? null, level, division.showRank);

	if (before === after) {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		return { applied: false, before, after } as const;
	}

	try {
		await member.setNickname(after);
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		return { applied: true, before, after } as const;
	} catch (e: any) {
		const truthy = new Set(['1', 'true', 'yes', 'on']);
		const DEV_BYPASS = truthy.has(String(process.env.DEV_ALLOW_NICK_EDIT || '').toLowerCase()) || truthy.has(String(process.env.ALLOW_NICK_DEV_APPROVE || '').toLowerCase());
		const missingPerms = e?.code === 50013 || String(e?.message || '').includes('Missing Permissions');
		if (DEV_BYPASS && missingPerms) {
			await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync", notes: "dev_bypass: Missing Permissions; nickname not changed" } });
			return { applied: false, before, after, reason: "missing_permissions_bypassed" } as const;
		}
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: `Set nickname failed: ${e?.code ?? e}` } });
		return { applied: false, before, after, reason: "error", error: String(e?.message ?? e), errorCode: e?.code } as const;
	}
}

export async function syncNicknameForDivision(params: { guild: any; userID: string; divisionCode: string }) {
	const { guild, userID, divisionCode } = params;
	const division = await prisma.division.findUnique({ where: { code: divisionCode } });
	if (!division) return { applied: false, reason: "division_not_found" } as const;

	const { level } = await computeLevelForUser(userID);
	const membership = await prisma.divisionMembership.upsert({
		where: { userID_divisionId: { userID, divisionId: division.id } },
		update: { lastComputedLevel: level, lastComputedAt: new Date() },
		create: { userID, divisionId: division.id, lastComputedLevel: level, lastComputedAt: new Date() },
	});

	if (!division.showRank) {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "in_sync" } });
		return { applied: false, reason: "division_hidden" } as const;
	}

	let member: GuildMember;
	try { member = await guild.members.fetch(userID); }
	catch {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: "Member not in guild" } });
		return { applied: false, reason: "member_not_found" } as const;
	}

	let userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
	if (!userRow?.preferredName && (userRow?.nickname?.trim()?.length)) {
		await prisma.user.update({ where: { id: userID }, data: { preferredName: userRow!.nickname! } }).catch(() => { });
		userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
	}
	const baseName = (userRow?.preferredName?.trim()?.length ? userRow!.preferredName! : (member.nickname ?? member.displayName));
	const before = member.nickname ?? member.displayName;
	const after = formatNickname(baseName, division.nicknamePrefix ?? null, level, division.showRank);
	if (before === after) {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		return { applied: false, before, after } as const;
	}

	try {
		await member.setNickname(after);
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		return { applied: true, before, after } as const;
	} catch (e: any) {
		const truthy = new Set(['1', 'true', 'yes', 'on']);
		const DEV_BYPASS = truthy.has(String(process.env.DEV_ALLOW_NICK_EDIT || '').toLowerCase()) || truthy.has(String(process.env.ALLOW_NICK_DEV_APPROVE || '').toLowerCase());
		const missingPerms = e?.code === 50013 || String(e?.message || '').includes('Missing Permissions');
		if (DEV_BYPASS && missingPerms) {
			await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync", notes: "dev_bypass: Missing Permissions; nickname not changed" } });
			return { applied: false, before, after, reason: "missing_permissions_bypassed" } as const;
		}
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: `Set nickname failed: ${e?.code ?? e}` } });
		return { applied: false, before, after, reason: "error", error: String(e?.message ?? e), errorCode: e?.code } as const;
	}
}
