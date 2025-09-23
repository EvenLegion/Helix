# /rank sync — How to use

This guide explains how to recompute and apply rank decorations to member nicknames based on their merits and division.

> Permissions
> - Only members with the Staff role can run `/rank` commands.
> - In development mode, this restriction may be bypassed for local testing.

## What it does
- Computes the member’s total merits and maps them to a level (1–40) using RankLevel.
- Chooses which division’s style to display (combat division with showRank = true; otherwise LGN).
- Formats the nickname: applies the division prefix and track symbols, and appends a circled sublevel when needed.
- Attempts to set the nickname in the guild, with a dev-mode bypass for Missing Permissions in development.
 - Before applying, presents a non-mutating preview and requires an explicit moderator approval (Apply) in the review UI.
 - When `preferredName` or visible division is missing, attempts to parse the current nickname to backfill `preferredName` and DivisionMembership (see Parsing below).

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
- The bot auto-selects the appropriate division per user (visible combat division or LGN). There is no global `division` override for sync-all.

Notes:
- A review screen is shown first with a paginated preview of proposed changes; moderators must click Apply to commit.
- Bots are skipped. Members the bot cannot manage are counted as "skipped (unmanageable)".
- A light throttle is applied to avoid rate limits.

## Nickname rules
- Base name: uses the user’s `preferredName` from the database. If not set, it falls back to the current nickname/display name and backfills `preferredName` once.
- Division prefix: taken from the division’s `nicknamePrefix`; duplicates are removed if already present.
- Track symbols by level milestones:
  - 20: ◇   30: ⬖   40: ◆
  - Exact 20/30/40 show only the symbol (no circled digit).
  - 1–19: a circled number (①..⑲) is appended.
  - 21–29 and 31–39: the last digit is rendered as a circled number and appended.
- Normalization avoids stacking symbols or repeating the prefix.
- Max nickname length is 32 characters; output is truncated if necessary.

### Nickname source precedence
- Division selection precedence:
  1) Existing DivisionMembership that has `showRank = true`.
  2) Parse from the user’s existing nickname in the database, then guild nickname/display.
  3) Fallback to LGN (Logistics) if nothing else matches.

- Base name (preferredName) precedence:
  1) `preferredName` if present.
  2) Parse a clean base name from the existing nickname (after removing any division prefix and rank symbols), then backfill `preferredName`.
  3) As a last resort, use the guild display name.

## Typical outcomes
- Success: `Synced user#1234: BEFORE → AFTER`
- No change needed: `No change needed for user#1234.`
- Dev bypass (local/dev without Manage Nicknames or role hierarchy):
  - `Approved (dev bypass): would set user#1234 to “AFTER”, but bot lacks permissions in this environment.`
- Hidden division: `Division XYZ does not show rank. Nothing to apply.`
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
- Only combat divisions and LGN display rank (`showRank = true`). Others are treated as hidden (no change applied).
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
- If a visible division is detected and the user lacks DivisionMembership, a membership is backfilled for that division.
- Hidden divisions are respected: if the selected division has `showRank = false`, no nickname change is applied.

Edge case guards:
- Avoids accidentally trimming the first character of the base name during parsing.
- Nickname parsing is null-safe and won’t throw on missing or unusual inputs.
