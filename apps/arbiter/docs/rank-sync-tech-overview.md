# /rank sync — Technical overview

Purpose: Document the implementation details and decisions behind the `/rank sync` feature: inputs, nickname decoration, persistence, permissions, and UX behavior.

Last updated: 2025-09-22

## Components and files

- `apps/arbiter/src/app/commands/rank/sync.ts`
  - Defines the `rank sync` slash command with STRING autocomplete of target users.
  - Zero-query suggestions: returns a curated set (recent/likely) without requiring the user to type.
  - Label rules: 1–100 chars, sanitized; shows decorated nicknames not raw IDs.
  - Name preference order: guild nickname → DB `preferredName` → username.
  - After applying nickname changes, persists decorated nickname to the DB `User.nickname`.

- `apps/arbiter/src/app/services/rankSync.ts`
  - Computes the decorated nickname based on division and rank.
  - Applies nickname to guild member when allowed; returns detailed result codes.
  - Persists the nickname on success or when there is no change.
  - Handles permission limitations (role hierarchy, missing Manage Nicknames) and supports dev bypass via env.

- `apps/arbiter/src/app/events/interactionCreate/nameChangeButtons.ts`
  - Approval flow mirrors permission logic used in rank sync and honors the same dev bypass.

## Data flow

1. Autocomplete provides a list of candidates based on typed input or zero-query.
2. On submit, the command resolves the member, computes the decorated nickname, and attempts to set it.
3. Result details are surfaced ephemerally to the moderator (applied/unchanged/not in guild/permission errors/dev bypass).
4. The resulting decorated nickname is persisted to the database user record.

## Permissions and dev bypass

- Requires Manage Nicknames and role hierarchy precedence to change nicknames.
- In dev environments, set `DEV_ALLOW_NICK_EDIT=1` (or `ALLOW_NICK_DEV_APPROVE=1` in name-change flow) to bypass applying nicknames but still mark approvals/persist nicknames.

## Logging

- Uses `@workspace/logger` interaction-scoped logs with `mod: 'rankSync'`/`'nameChange'`.
- Levels: debug for decisions and outcomes, warn for guard situations (dev bypass), error for exceptions.

## Edge cases

- Member not found in guild: report and persist nickname to DB anyway for visibility.
- Division hidden or user lacks a visible division: skip nickname apply but report reason (no change applied).
- Long names: gracefully truncate to Discord length limits.
