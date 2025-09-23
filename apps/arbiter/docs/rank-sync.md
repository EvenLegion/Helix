# /rank sync — How to use

This guide explains how to recompute and apply rank decorations to member nicknames based on their merits and division.

> Permissions
> - Only members with the Staff role can run `/rank` commands.
> - In development mode, this restriction may be bypassed for local testing.

## What it does
- Computes the member’s total merits and maps them to a level using RankLevel (circled suffix is supported up to 50).
- Chooses which division’s style to display:
  - Prefer a combat division with `showRank = true` (full decorations).
  - If none, prefer a `staff` division to maintain its prefix only (no rank decorations).
  - Otherwise fallback to LGN.
- Formats the nickname:
  - Always applies the division prefix and removes duplicates.
  - Adds track symbols and a circled number only when the selected division has `showRank = true`.
- Attempts to set the nickname in the guild, with a dev-mode bypass for Missing Permissions in development.
 - Before applying, presents a non-mutating preview and requires an explicit moderator approval (Apply) in the review UI.
 - When `preferredName` or a visible division is missing, attempts to parse the current nickname to backfill `preferredName` and DivisionMembership (see Parsing below).

## Command

### `/rank sync`
Recompute and apply a nickname for the selected user.

Options:
- `user` (required): The target guild member.
- `division` (optional): Division code (e.g., HLO, VNG, LGN). If omitted, the bot auto-selects a visible combat division or LGN.

Autocomplete:
- The `division` option supports autocomplete by division code and name.

### `/rank sync-all`
Recompute and apply nicknames for all members in the current guild.

Behavior:
- The bot auto-selects the appropriate division per user in this order: visible combat (showRank=true) → staff (prefix-only) → parsed from existing nickname → LGN. There is no global `division` override for sync-all.

Notes:
- A review screen is shown first with a paginated preview of proposed changes; moderators must click Apply to commit.
- Bots are skipped. Members the bot cannot manage are counted as "skipped (unmanageable)".
- A light throttle is applied to avoid rate limits.

## Nickname rules
- Base name: uses the user’s `preferredName` from the database. If not set, it falls back to the current nickname/display name and backfills `preferredName` once.
- Division prefix: taken from the division’s `nicknamePrefix`; duplicates are removed if already present.
 - Track symbols by level milestones (only when rank is shown):
  - 20: ◇   30: ⬖   40: ◆
 - Circled numbers: for any level ≥ 1 (when rank is shown), a circled number is appended using Unicode:
  - 1–19: ①..⑲
  - 20: ⑳
  - 21–35: ㉑ ㉒ ㉓ ㉔ ㉕ ㉖ ㉗ ㉘ ㉙ ㉚ ㉛ ㉜ ㉝ ㉞ ㉟
  - 36–50: ㊱ ㊲ ㊳ ㊴ ㊵ ㊶ ㊷ ㊸ ㊹ ㊺ ㊻ ㊼ ㊽ ㊾ ㊿
 - Note: We now always show the circled suffix when rank is shown, including at 20/30/40 (they’ll get both the track symbol in the prefix area and the circled number at the end).
- When the selected division has `showRank = false` and `kind = 'staff'`, only the division prefix is maintained (no track symbols or circled suffix). Other hidden divisions are skipped.
- Normalization avoids stacking symbols or repeating the prefix.
- Max nickname length is 32 characters; output is truncated if necessary.

### Nickname source precedence
- Division selection precedence:
  1) Existing DivisionMembership that has `showRank = true` (combat/visible).
  2) Existing DivisionMembership where `division.kind = 'staff'` (prefix-only).
  3) Parse from the user’s existing nickname in the database, then guild nickname/display.
  4) Fallback to LGN (Logistics) if nothing else matches.

- Base name (preferredName) precedence:
  1) `preferredName` if present.
  2) Parse a clean base name from the existing nickname (after removing any division prefix and rank symbols), then backfill `preferredName`.
  3) As a last resort, use the guild display name.

## Typical outcomes
- Success: `Synced user#1234: BEFORE → AFTER`
- No change needed: `No change needed for user#1234.`
- Dev bypass (local/dev without Manage Nicknames or role hierarchy):
  - `Approved (dev bypass): would set user#1234 to “AFTER”, but bot lacks permissions in this environment.`
- Hidden division (non-staff): `Division XYZ does not show rank. Nothing to apply.`
- Staff (hidden) division: Prefix-only update applied; rank symbols and circled number omitted.
- Not in guild: `User is not in this guild.`
- Division not found: `Division XYZ not found.`
- Error: an error code/message is returned.

## Dev mode
To reduce friction during development, the bot can bypass nickname application when it lacks permissions and still report what it would have set.

Set one of the following environment variables to a truthy value (1/true/yes/on):
- `DEV_ALLOW_NICK_EDIT`
- `ALLOW_NICK_DEV_APPROVE`

When triggered by a permissions error (50013), the command reports a dev-bypass outcome and does not change the nickname.

## Examples

- Auto-pick division and sync:
  - `/rank sync user: @Pilot`

- Force a specific division style:
  - `/rank sync user: @Pilot division: HLO`

## Notes
- Only divisions with `showRank = true` display rank decorations. Staff divisions may maintain their prefix even when `showRank = false`; other hidden divisions are skipped.
- `/event stop` also attempts a nickname sync for users who receive merits and summarizes the results in the confirmation message.

## Review and approval flow
Both `/rank sync` and `/rank sync-all` now show a review screen before any changes are made:

- The preview lists entries as “BEFORE → AFTER”, with “no change” where applicable.
- Use Prev/Next to page through the list (bulk mode).
- Click Apply to commit all proposed changes on the current review; click Cancel to exit without changes.
- Only the moderator who initiated the review can control the review UI.
- After Apply/Cancel, the UI is cleared to avoid stale interactions.

## Parsing legacy nicknames (backfill)
When users already have decorated nicknames (e.g., `RFT | Sigeth ①`, `HVK ◇ | quin ①`), the sync logic:

- Strips known rank symbols (◇, ⬖, ◆ and circled digits) and detects a division by matching either the configured `nicknamePrefix` (e.g., `RFT |`) or the division `code` at the start.
- Extracts a clean base name (e.g., `Sigeth`) and uses it to backfill `preferredName` if it’s missing.
- If a division (combat or staff) is detected and the user lacks DivisionMembership, a membership is backfilled for that division.
- Hidden divisions are respected: if the selected division has `showRank = false` and is `kind = 'staff'`, we still perform a prefix-only update; otherwise, no nickname change is applied.

Edge case guards:
- Avoids accidentally trimming the first character of the base name during parsing.
- Nickname parsing is null-safe and won’t throw on missing or unusual inputs.
