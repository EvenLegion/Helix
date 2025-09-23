import { prisma } from "@workspace/db";
import type { GuildMember } from "discord.js";
import { PermissionsBitField } from "discord.js";

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

// Utility: collapse whitespace and trim
function cleanLabel(s: string) {
	return String(s ?? '').replace(/\s+/g, ' ').trim();
}

// Parse division code/prefix and extract a base name from an existing nickname/display
// Heuristics:
// - Strip leading track symbols (◇ ⬖ ◆) and whitespace
// - Try to match a Division.nicknamePrefix at the start (case-insensitive, flexible spaces)
// - Else try to match a Division.code at the start followed by a separator (space, |, -, —, :)
// - Strip trailing circled digits (rank suffix)
// - Return detected division (if any) and the cleaned base name
async function parseDivisionAndBaseFromNickname(nickname: string): Promise<{ division: { id: number; code: string; nicknamePrefix: string | null; showRank: boolean; kind: string } | null; baseName: string }> {
	let name = String(nickname ?? '');
	// Strip leading symbols
	name = name.replace(/^(?:[\u25c7\u2b16\u25c6]\s*)+/u, '').trimStart();
	const divisions = await prisma.division.findMany({ select: { id: true, code: true, nicknamePrefix: true, showRank: true, kind: true } });
	let matched: { id: number; code: string; nicknamePrefix: string | null; showRank: boolean; kind: string } | null = null;
	const original = name;
	// Try nicknamePrefix matches first
	for (const d of divisions) {
		if (!d.nicknamePrefix) continue;
		const esc = escapeRegExp(d.nicknamePrefix).replace(/\s+/g, '\\s*');
		const re = new RegExp(`^${esc}\\s*`, 'i');
		if (re.test(name)) {
			name = name.replace(re, '').trimStart();
			matched = d;
			break;
		}
	}
	// If no prefix matched, try code at start followed by a separator
	if (!matched) {
		for (const d of divisions) {
			const code = escapeRegExp(d.code);
			const re = new RegExp(`^${code}(?:\\b|\n|\r|\t|\s|[|\-—:])`, 'i');
			if (re.test(name)) {
				// remove just the code and adjacent separators/spaces
				name = name.replace(new RegExp(`^${code}\s*(?:[|\-—:])?\s*`, 'i'), '').trimStart();
				matched = d;
				break;
			}
		}
	}
	// If still no match, restore original (we might have stripped only symbols)
	if (!matched) name = original;
	// Strip trailing circled number rank suffix
	name = name.replace(/\s[\u24ea\u2460-\u2472]\s*$/u, '').trim();
	// Collapse internal whitespace
	name = cleanLabel(name);
	return { division: matched, baseName: name };
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
	return null;
}

async function getLGNDivision() {
	return await prisma.division.findUnique({ where: { code: "LGN" } });
}

export async function syncNicknameAuto(params: { guild: any; userID: string }) {
	const { guild, userID } = params;
	// Prefer division from existing membership
	let division = await pickDisplayDivision(userID);
	// Fetch member early for parsing and name fallback
	let member: GuildMember | null = null;
	try { member = await guild.members.fetch(userID); } catch { member = null; }
	// If no membership division, try to parse from DB nickname first, then guild nickname/display
	if (!division) {
		// Fetch user row to check DB nickname
		const userRowForParse = await prisma.user.findUnique({ where: { id: userID }, select: { nickname: true } });
		const candidate = cleanLabel(userRowForParse?.nickname ?? '') || cleanLabel(member ? (member.nickname ?? member.displayName) : '');
		if (candidate) {
			try {
				const parsed = await parseDivisionAndBaseFromNickname(candidate);
				if (parsed.division) {
					division = parsed.division as any;
					// Backfill a DivisionMembership if missing
					try {
						const existing = await prisma.divisionMembership.findFirst({ where: { userID, divisionId: parsed.division.id } });
						if (!existing) {
							await prisma.divisionMembership.create({ data: { userID, divisionId: parsed.division.id, lastComputedAt: new Date() } });
						}
					} catch { /* ignore */ }
				}
			} catch { /* ignore */ }
		}
	}
	// Final fallback to LGN if still none
	if (!division) division = await getLGNDivision() as any;
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

	if (!member) {
		try { member = await guild.members.fetch(userID); } catch { member = null; }
	}
	if (!member) {
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: "Member not in guild" } });
		return { applied: false, reason: "member_not_found" } as const;
	}

	// Base name: preferredName if set in DB, else current display nickname
	let userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
	let baseName: string;
	if (userRow?.preferredName?.trim()?.length) {
		baseName = userRow.preferredName;
	} else {
		// Prefer DB nickname for parsing; else derive from nickname/display by stripping decorations
		const current = cleanLabel(userRow?.nickname ?? '') || (member.nickname ?? member.displayName);
		try {
			const parsed = await parseDivisionAndBaseFromNickname(current);
			// Guard: avoid accidental removal of the first character (e.g., "Sigeth" -> "igeth")
			if (parsed.baseName && current && parsed.baseName.length + 1 === current.length && current.startsWith(parsed.baseName.slice(0, 1)) === false) {
				baseName = current; // fallback to original
			} else {
				baseName = parsed.baseName || current;
			}
			// backfill preferredName once
			await prisma.user.update({ where: { id: userID }, data: { preferredName: baseName } }).catch(() => { });
			userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true, name: true, username: true } });
		} catch {
			baseName = current;
		}
	}
	const before = member.nickname ?? member.displayName;
	const after = formatNickname(baseName, division.nicknamePrefix ?? null, level, division.showRank);

	if (before === after) {
		// Update tracking and persist the nickname into DB for autocomplete/display fallbacks
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		await prisma.user.update({ where: { id: userID }, data: { nickname: after } }).catch(() => { });
		return { applied: false, before, after } as const;
	}

	try {
		await member.setNickname(after);
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		await prisma.user.update({ where: { id: userID }, data: { nickname: after } }).catch(() => { });
		return { applied: true, before, after } as const;
	} catch (e: any) {
		const truthy = new Set(['1', 'true', 'yes', 'on']);
		const DEV_BYPASS = truthy.has(String(process.env.DEV_ALLOW_NICK_EDIT || '').toLowerCase()) || truthy.has(String(process.env.ALLOW_NICK_DEV_APPROVE || '').toLowerCase());
		const missingPerms = e?.code === 50013 || String(e?.message || '').includes('Missing Permissions');
		const me = guild?.members?.me;
		const hasManageNick = !!me?.permissions?.has(PermissionsBitField.Flags.ManageNicknames);
		const isHierarchy = typeof (member as any)?.manageable === 'boolean' ? !(member as any).manageable : false;
		const permDetail = isHierarchy ? 'role_hierarchy' : (!hasManageNick ? 'missing_manage_nicknames' : 'missing_permissions');
		if (DEV_BYPASS && missingPerms) {
			await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync", notes: "dev_bypass: Missing Permissions; nickname not changed" } });
			return { applied: false, before, after, reason: "missing_permissions_bypassed", permDetail } as const;
		}
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: `Set nickname failed: ${e?.code ?? e}` } });
		return { applied: false, before, after, reason: "error", error: String(e?.message ?? e), errorCode: e?.code, permDetail: missingPerms ? permDetail : undefined } as const;
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
		await prisma.user.update({ where: { id: userID }, data: { nickname: after } }).catch(() => { });
		return { applied: false, before, after } as const;
	}

	try {
		await member.setNickname(after);
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync" } });
		await prisma.user.update({ where: { id: userID }, data: { nickname: after } }).catch(() => { });
		return { applied: true, before, after } as const;
	} catch (e: any) {
		const truthy = new Set(['1', 'true', 'yes', 'on']);
		const DEV_BYPASS = truthy.has(String(process.env.DEV_ALLOW_NICK_EDIT || '').toLowerCase()) || truthy.has(String(process.env.ALLOW_NICK_DEV_APPROVE || '').toLowerCase());
		const missingPerms = e?.code === 50013 || String(e?.message || '').includes('Missing Permissions');
		const me = guild?.members?.me;
		const hasManageNick = !!me?.permissions?.has(PermissionsBitField.Flags.ManageNicknames);
		const isHierarchy = typeof (member as any)?.manageable === 'boolean' ? !(member as any).manageable : false;
		const permDetail = isHierarchy ? 'role_hierarchy' : (!hasManageNick ? 'missing_manage_nicknames' : 'missing_permissions');
		if (DEV_BYPASS && missingPerms) {
			await prisma.divisionMembership.update({ where: { id: membership.id }, data: { lastAppliedNicknameLevel: level, lastNicknameUpdatedAt: new Date(), nicknameSyncStatus: "in_sync", notes: "dev_bypass: Missing Permissions; nickname not changed" } });
			return { applied: false, before, after, reason: "missing_permissions_bypassed", permDetail } as const;
		}
		await prisma.divisionMembership.update({ where: { id: membership.id }, data: { nicknameSyncStatus: "error", notes: `Set nickname failed: ${e?.code ?? e}` } });
		return { applied: false, before, after, reason: "error", error: String(e?.message ?? e), errorCode: e?.code, permDetail: missingPerms ? permDetail : undefined } as const;
	}
}

// Preview helpers (non-mutating): compute what nickname would be set without applying or writing to DB
export type NickPreview =
	| { kind: "ok"; willChange: boolean; before: string; after: string }
	| { kind: "skip"; reason: "no_division" | "division_hidden" | "member_not_found" }
	| { kind: "error"; message: string };

export async function previewNicknameAuto(params: { guild: any; userID: string }): Promise<NickPreview> {
	const { guild, userID } = params;
	try {
		// Prefer division from membership
		let division = await pickDisplayDivision(userID);
		let member: GuildMember;
		try { member = await guild.members.fetch(userID); }
		catch { return { kind: "skip", reason: "member_not_found" }; }
		// If no membership-based division, try parsing from DB nickname first, then guild nickname/display
		if (!division) {
			const userRowForParse = await prisma.user.findUnique({ where: { id: userID }, select: { nickname: true } });
			const candidate = cleanLabel(userRowForParse?.nickname ?? '') || (member.nickname ?? member.displayName);
			const parsed = await parseDivisionAndBaseFromNickname(candidate);
			if (parsed.division) division = parsed.division as any;
		}
		if (!division) division = await getLGNDivision() as any;
		if (!division) return { kind: "skip", reason: "no_division" };
		if (!division.showRank) return { kind: "skip", reason: "division_hidden" };
		const { level } = await computeLevelForUser(userID);
		const userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true, nickname: true } });
		let baseName = userRow?.preferredName?.trim()?.length ? userRow!.preferredName! : '';
		if (!baseName) {
			const candidate = cleanLabel(userRow?.nickname ?? '') || (member.nickname ?? member.displayName);
			const parsed = await parseDivisionAndBaseFromNickname(candidate);
			if (parsed.baseName && candidate && parsed.baseName.length + 1 === candidate.length && candidate.startsWith(parsed.baseName.slice(0, 1)) === false) {
				baseName = candidate;
			} else {
				baseName = parsed.baseName || candidate;
			}
		}
		const before = member.nickname ?? member.displayName;
		const after = formatNickname(baseName, division.nicknamePrefix ?? null, level, division.showRank);
		return { kind: "ok", willChange: before !== after, before, after };
	} catch (e: any) {
		return { kind: "error", message: String(e?.message ?? e) };
	}
}

export async function previewNicknameForDivision(params: { guild: any; userID: string; divisionCode: string }): Promise<NickPreview> {
	const { guild, userID, divisionCode } = params;
	try {
		const division = await prisma.division.findUnique({ where: { code: divisionCode } });
		if (!division) return { kind: "error", message: `Division ${divisionCode} not found` };
		if (!division.showRank) return { kind: "skip", reason: "division_hidden" };
		let member: GuildMember;
		try { member = await guild.members.fetch(userID); }
		catch { return { kind: "skip", reason: "member_not_found" }; }
		const { level } = await computeLevelForUser(userID);
		const userRow = await prisma.user.findUnique({ where: { id: userID }, select: { preferredName: true } });
		const baseName = (userRow?.preferredName?.trim()?.length ? userRow!.preferredName! : (member.nickname ?? member.displayName));
		const before = member.nickname ?? member.displayName;
		const after = formatNickname(baseName, division.nicknamePrefix ?? null, level, division.showRank);
		return { kind: "ok", willChange: before !== after, before, after };
	} catch (e: any) {
		return { kind: "error", message: String(e?.message ?? e) };
	}
}
