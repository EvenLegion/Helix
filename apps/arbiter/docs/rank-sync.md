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

Options:
- `division` (optional): Division code to apply for everyone (e.g., HLO, VNG, LGN). If omitted, the bot auto-selects per user.

Notes:
- Progress updates are posted in the ephemeral reply as the sync runs.
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
