import { syncNicknameAuto, syncNicknameForDivision } from "./rankSync";

export type NickSyncOutcome =
    | { kind: "applied"; applied: boolean }
    | { kind: "skip"; reason: "division_hidden" | "member_not_found" | "missing_permissions_bypassed" }
    | { kind: "error"; message: string };

export async function syncNicknameAndSummarize(params: { guild: any; userID: string; divisionCode?: string }): Promise<{ outcome: NickSyncOutcome; message: string }> {
    const { guild, userID, divisionCode } = params;
    try {
        const res = divisionCode
            ? await syncNicknameForDivision({ guild, userID, divisionCode })
            : await syncNicknameAuto({ guild, userID });

        if (res && typeof res === 'object' && 'applied' in res) {
            const applied = !!(res as any).applied;
            const before = (res as any).before;
            const after = (res as any).after;
            const message = applied && before && after ? `${before} → ${after}` : (applied ? "applied" : "no change");
            return { outcome: { kind: "applied", applied }, message };
        }
        const reason = (res as any)?.reason as string | undefined;
        if (reason === 'division_hidden' || reason === 'member_not_found' || reason === 'missing_permissions_bypassed') {
            return { outcome: { kind: "skip", reason }, message: reason.replace(/_/g, ' ') };
        }
        if (reason === 'error') {
            const code = (res as any)?.errorCode ? ` ${String((res as any).errorCode)}` : '';
            const detail = (res as any)?.permDetail ? ` ${(res as any).permDetail}` : '';
            const base = String((res as any)?.message ?? (res as any)?.error ?? 'unknown error');
            const message = `${base}${code}${detail}`.trim();
            return { outcome: { kind: "error", message }, message };
        }
        // Fallback: unknown shape
        return { outcome: { kind: "applied", applied: false }, message: "no change" };
    } catch (e: any) {
        const msg = String(e?.message ?? e);
        return { outcome: { kind: "error", message: msg }, message: msg };
    }
}
