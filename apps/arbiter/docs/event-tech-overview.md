# /event feature — Technical overview

Purpose: Provide reviewers a clear map of the code added/changed to support the `/event` commands (start, add-vc, stop), how data flows, and what schema/migrations were introduced.

Last updated: 2025-09-24

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
    - If no explicit channel/name is provided, auto-creates a sibling channel with a "-subN" suffix based on the root channel name.
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
- Inactivity watcher:
  - Computes inactivity based on recent presence/speaking activity with a “creator present” gate.
  - After a configured grace period, posts an alert to a notify channel and attempts to create a thread anchored to that alert.
  - Inside the thread, pings leadership roles and posts a live “Close Event” button.
  - Stores thread/message IDs in an in-memory notify store for follow-ups.
- `apps/arbiter/src/app/services/channelCleanup.ts`
  - After stop, watches `createdByBot` channels; deletes when empty (permission-checked), with a TTL safeguard.
- `apps/arbiter/src/app/services/reviewStore.ts`
  - In-memory review state keyed by `${sessionId}:${reviewerId}` to persist reviewer selections across UI interactions.
- `apps/arbiter/src/app/services/notifyStore.ts`
  - In-memory storage of inactivity alert parent message and follow-up thread message IDs, keyed by session/root.
- `apps/arbiter/src/app/services/nameCache.ts`
  - Per-page name cache to minimize repeated lookups and allow overlay of live guild display names.

3) UI & interaction handlers
- `apps/arbiter/src/app/ui/eventReview.ts`
  - Builds the ephemeral review message with paging and per-user Merit/None toggles.
  - Uses compact 4-user pages due to Discord row limits.
  - Displays per-user metrics: total present, total speaking (approx), and participation %.
- `apps/arbiter/src/app/events/interactionCreate/eventReview.ts`
  - Handles button interactions with `customId` prefix `eventrev:`.
  - Supports radio-button style selection, pagination, confirm/cancel.
  - On confirm, looks up `MeritType` via relation and upserts/aggregates `Merit` for selected users (existing users only). Uses an upsert keyed by `userID` to increment `merits` by the `MeritType.value`.
  - After awarding, attempts nickname sync for each awarded user using `syncNicknameAuto` (respects permission limits and supports dev bypass); summarizes outcomes in the confirmation message.
  - Posts a follow-up into the inactivity thread indicating the review has completed (with/without merits) and clears the notify store.
- `apps/arbiter/src/app/events/interactionCreate/meritTypeAutocomplete.ts`
  - Autocomplete for the `merit_type` option in `/event start` using Prisma ORM.
- `apps/arbiter/src/app/events/interactionCreate/eventCloseButton.ts`
  - Handles `event:close:*` buttons from alerts/threads.
  - Shows a confirmation dialog with Confirm, Close w/No Merits, Cancel.
  - On Confirm: ends grouped sessions, aggregates into root, opens review, posts thread follow-up.
  - On No Merits: ends sessions, posts thread follow-up, clears notify entry.
  - Permissions: Admin, Centurion role, or the event creator. Works from DMs by resolving the guild context.

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
  5. On confirm, upsert/aggregate `Merit` for selected users based on `MeritType.value`; then attempt nickname sync and include a summary in the confirmation.
  6. Post a follow-up in the inactivity thread and clear notify mapping.

- Inactivity:
  1. Tracker detects prolonged inactivity with creator-present gating.
  2. Sends a parent alert to the notify channel (without role mentions).
  3. Tries thread creation in this order: anchor via startMessage, startThread on message, channel.threads.create (public/private as available).
  4. Posts a new message inside the thread with role pings limited via allowedMentions and a live Close button; stores IDs in notifyStore.
  5. If thread creation fails, edits the parent with a safe role ping and Close button as a fallback.

## Error handling and permissions
- Channel resolution errors reply ephemerally with guidance.
- Creating channels requires bot `Manage Channels`; failures show specific hints (handles Discord error code 50013).
- Review interactions are restricted to the user who initiated the review.
- Close interactions allow Admin, Centurion role, or the original event creator; supports DM-origin interactions by resolving the guild and channel context.
- Raw SQL is avoided for renamed tables; Prisma ORM is used consistently.

## Recent enhancements (Sep 2025)

- Award description is required in `/event start` and must be at least 5 characters; it is displayed in the review header and echoed back in the confirmation.
- When creating sub-VCs via `/event add-vc` without an explicit channel/name, the bot auto-creates a channel based on the root name with a `-subN` suffix.
- Name resolution during review builds a per-page name map prioritized as: DB `nickname/name/username` → guild member displayName → user.username → user ID; the current page is refreshed from the guild to ensure up-to-date display.
- Post-confirm, nickname sync is attempted for awarded users; outcomes include success, no change, not in guild, or permission-related reasons (with dev bypass support).
- Structured logging via `@workspace/logger` replaces `console.*` across the feature: debug for normal flow/metrics, warn for guard checks and expected issues, error for failures.
- Inactivity alerts spawn a thread titled “Stale Event Tracking: <VC Name>” with leadership ping and a live Close button; follow-ups are posted on review open/complete or when closed without merits.
- Thread creation is resilient with multiple strategies and logs permission diagnostics: `CreatePublicThreads`, `CreatePrivateThreads`, `SendMessagesInThreads`.
- Debug verbosity is controlled solely by the logger level; extra ad-hoc gating removed to keep diagnostics rich when LOG_LEVEL=debug.
- Review UI now shows total time present, total speaking, and participation %. Default selection remains at ≥ 20% presence.

## Notes for reviewers
- Speaking-time is approximated; can be swapped for a more precise method if voice receivers are allowed.
- In-memory review/name caches are process-local; if multi-instance, consider a shared store.
- Aggregation threshold defaults (20% presence → Merit) are implemented in the stop flow before showing the UI.
- Cleanup deletes only bot-created channels and only once empty; protected by permission checks and TTL.
- Notify store is in-memory and process-local; if the bot runs multiple instances, thread follow-ups may need a shared store to avoid duplicates.

## Environment variables
- EVENT_INACTIVITY_MINUTES: minutes of inactivity before alerting (prod). Default 30.
- EVENT_INACTIVITY_DEV: minutes in development. Default 1.
- EVENT_NOTIFY_CHANNEL / EVENT_NOTIFY_CHANNEL_ID: where to post alerts.
- EVENT_DEV_NOTIFY_USER_ID: optional dev user ID to DM in development on inactivity.
- EVENT_MERIT_MIN_SPEAKING_PCT: default minimum not-muted% of session when a MeritType doesn't specify. Default 20.
- EVENT_MERIT_MIN_PRESENT_PCT: default minimum present% of session when a MeritType doesn't specify. Default 5.
- EVENT_MERIT_MIN_SPEAKING_PCT_OVERRIDE: optional testing override to force speaking% threshold globally.
- EVENT_MERIT_MIN_PRESENT_PCT_OVERRIDE: optional testing override to force present% threshold globally.
- LOG_LEVEL, NODE_ENV: control logging verbosity and format (see logging overview).
