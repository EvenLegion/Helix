# /event feature — Technical overview

Purpose: Provide reviewers a clear map of the code added/changed to support the `/event` commands (start, add-vc, stop), how data flows, and what schema/migrations were introduced.

## Components and files

1) Command entrypoint
- `apps/arbiter/src/app/commands/event/start.ts`
  - Declares the `event` slash command with subcommands: `start`, `add-vc`, `stop`.
  - start:
    - Validates `merit_type` via `prisma.meritType` and prevents duplicate sessions per channel.
    - Resolves target voice/stage channel from context or `channel` option.
    - Creates `EventSession` row and starts the session tracker.
  - add-vc:
    - Finds the "root" session (from context or single active session in guild).
    - Either attaches an existing channel or creates a new one (copies permission overwrites and matches type).
    - Creates a child `EventSession` with `rootSessionId = <root.id>` and `createdByBot = true` when created.
    - Starts a tracker for the child session.
  - stop:
    - Determines the group: the root session plus all children.
    - Ends all sessions and stops their trackers.
    - Starts cleanup watchers for channels that were bot-created.
    - Aggregates `EventSessionParticipant` rows across the group into the root session and opens the review UI.

2) Services
- `apps/arbiter/src/app/services/sessionTracker.ts`
  - Periodic sampling (every 15s) of members in a voice/stage channel.
  - Upserts `EventSessionParticipant` rows for presence time and a simple speaking-time approximation.
  - Ends session if the channel disappears.
- `apps/arbiter/src/app/services/channelCleanup.ts`
  - After stop, watches `createdByBot` channels; deletes when empty (permission-checked), with a TTL safeguard.
- `apps/arbiter/src/app/services/reviewStore.ts`
  - In-memory review state keyed by `${sessionId}:${reviewerId}` to persist reviewer selections across UI interactions.
- `apps/arbiter/src/app/services/nameCache.ts`
  - Per-page name cache to minimize repeated lookups and allow overlay of live guild display names.

3) UI & interaction handlers
- `apps/arbiter/src/app/ui/eventReview.ts`
  - Builds the ephemeral review message with paging and per-user Merit/None toggles.
  - Uses compact 4-user pages due to Discord row limits.
- `apps/arbiter/src/app/events/interactionCreate/eventReview.ts`
  - Handles button interactions with `customId` prefix `eventrev:`.
  - Supports radio-button style selection, pagination, confirm/cancel.
  - On confirm, looks up `MeritType` via relation and upserts `Merit` for selected users (existing users only).
- `apps/arbiter/src/app/events/interactionCreate/meritTypeAutocomplete.ts`
  - Autocomplete for the `merit_type` option in `/event start` using Prisma ORM.

4) Database and Prisma
- Schema: `packages/database/prisma/schema.prisma`
  - `EventSession` (arbiter.eventSession):
    - Fields: id, rootSessionId (self-relation), guildId, channelId, createdByBot, startedBy, startedAt, endedAt, status, meritTypeId.
    - Indexes: (guildId, channelId, status), (rootSessionId, status).
  - `EventSessionParticipant` (arbiter.eventSessionParticipant):
    - Fields: id, eventSessionId, userId, totals (present/speaking), lastJoinAt, lastSpeakAt, updatedAt.
    - Unique: (eventSessionId, userId).
  - `MeritType` (arbiter.meritType) and existing `Merit` relation.
  - Physical table names are CamelCase via `@@map`.
- Key migrations: `packages/database/prisma/migrations/`
  - `20250918225418_add_event_session_and_participants/` — initial event tables (snake_case).
  - `20250920213220_add_eventsession_grouping/` — adds `rootSessionId` and index.
  - `20250921024331_add_created_by_bot/` — adds `createdByBot` boolean.
  - `20250921035745_rename_snake_to_camel_tables/` — re-creates tables with CamelCase physical names; indices and FKs.
  - (Other interim migrations adjusted column types and naming; current schema reflects CamelCase tables.)

## Data flow summary
- Start:
  1. Resolve channel → create `EventSession` (root) → start tracker.
  2. Tracker samples presence/speaking → upsert `EventSessionParticipant`.
- Add-VC:
  1. Resolve root session → create/attach a channel → create child `EventSession` with `rootSessionId` → start tracker.
- Stop:
  1. Find group (root + children) → set `endedAt` and stop trackers.
  2. Start cleanup watchers for `createdByBot` channels.
  3. Aggregate participants across ended sessions into the root session.
  4. Build review message; reviewer toggles choices and confirms.
  5. On confirm, upsert `Merit` for selected users based on `MeritType` value.

## Error handling and permissions
- Channel resolution errors reply ephemerally with guidance.
- Creating channels requires bot `Manage Channels`; failures show specific hints (handles Discord error code 50013).
- Review interactions are restricted to the user who initiated the review.
- Raw SQL is avoided for renamed tables; Prisma ORM is used consistently.

## Notes for reviewers
- Speaking-time is approximated; can be swapped for a more precise method if voice receivers are allowed.
- In-memory review/name caches are process-local; if multi-instance, consider a shared store.
- Aggregation threshold defaults (20% presence → Merit) are implemented in the stop flow before showing the UI.
- Cleanup deletes only bot-created channels and only once empty; protected by permission checks and TTL.
