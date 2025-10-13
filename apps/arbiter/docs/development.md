# Development utilities — commands and notes

These commands help with testing, data seeding, and content previews. They are intended for maintainers and may be restricted to dev environments.

## /import-users
Updates the user database from the guild members.
- Fetches members (filtered by a configured role in the command file) and upserts into the `User` table.
- Fields saved: id, username, nickname; placeholder values for email/name are used where necessary.
- Run in a server where the bot has permissions to fetch members.

Source: `apps/arbiter/src/app/commands/development/updateUserDB.ts`

## /get-users
Exports selected members with roles to a CSV.
- Filters members by a specified role, and selects a subset of roles to include in the CSV.
- Produces a temporary file and returns it as an attachment.

Source: `apps/arbiter/src/app/commands/development/getUsers.ts`

## /welcome-test
Sends a test welcome embed to a designated channel.
- Channel ID is configured directly in the command file.
- Useful for previewing the welcome message layout.

Source: `apps/arbiter/src/app/commands/development/welcomeEmbed.ts`

Notes:
- These utilities may assume specific role IDs and channel IDs configured in the code; adjust them before use in production.
- For any changes to text or logic, edit the corresponding file under `apps/arbiter/src/app/commands/development/`.

## Windows/OneDrive build note — Nexus prebuild cleanup

We added a prebuild step to the Nexus app that removes the `.next` folder before each production build:

- Location: `apps/nexus/package.json`
- Script: `"prebuild": "rimraf .next"`

Why this exists:
- On some Windows machines where the repo lives under OneDrive, Next.js occasionally fails with an `EINVAL: invalid argument, readlink` error against `.next/server/chunks`. This is due to OneDrive’s file virtualization and how symlinks/junctions are handled under the `.next` build output.
- Deleting `.next` prior to each build avoids stale or partially synced artifacts that can trigger the error.

Impact:
- Clean builds on Windows/OneDrive without manual intervention.
- Negligible overhead; the folder is recreated on each build anyway.

Alternatives or additional mitigations:
- Keep the repo outside of OneDrive-backed paths.
- Manually delete `.next` when the error occurs (the script automates this).
- Use a separate working directory for builds (e.g., local temp directory) if desired.

## Discord Interaction Timeout Handling

Discord interactions must be acknowledged within 3 seconds or they expire with "Unknown interaction" errors. For operations that may take longer (database queries, API calls), we implement defensive patterns:

### Button Interactions (Event Review)
- **File**: `apps/arbiter/src/app/events/interactionCreate/eventReview.ts`
- **Pattern**: Use `safeUpdate()` helper that calls `deferUpdate()` early, then `editReply()` 
- **When**: Any button interaction that involves database work or API calls

```typescript
// Acknowledge quickly, then edit the message later
if (!interaction.deferred && !interaction.replied) {
  await interaction.deferUpdate();
}
// ... do slow work ...
await interaction.editReply(content);
```

### Autocomplete Interactions
- **File**: `apps/arbiter/src/app/events/interactionCreate/meritTypeAutocomplete.ts`
- **Pattern**: Wrap `interaction.respond()` in try/catch for graceful timeout handling
- **Reason**: Users typing quickly can trigger multiple autocomplete requests; late responses fail silently

```typescript
try {
  await interaction.respond(items);
} catch (e) {
  if (e?.code === 10062) {
    log.debug('Autocomplete token expired (ignored)');
  }
}
```

## Prisma Development Tools

### Latency Simulation
For testing interaction timeouts locally, the `@workspace/db` package supports artificial latency injection:

**Environment Variables:**
```bash
# Fixed delay for all queries
PRISMA_LATENCY_MS=800
PRISMA_LATENCY_PCT=100

# Random delay range  
PRISMA_LATENCY_RANGE=300-1500
PRISMA_LATENCY_PCT=60

# Limit to specific models
PRISMA_LATENCY_MODELS=User,EventSession,Merit
```

**Usage:**
```powershell
# Simulate slow cloud DB (random 400-1200ms delay on 75% of queries)
$env:PRISMA_LATENCY_RANGE='400-1200'; $env:PRISMA_LATENCY_PCT=75
pnpm dev
```

**Implementation**: Middleware in `packages/database/src/client.ts` uses `setTimeout()` before query execution.

### Enhanced Logging
Enable detailed Prisma operation logging for debugging:

```bash
# Middleware-based summary (recommended)
PRISMA_LOG_MW=1
PRISMA_SLOW_MS=200

# Raw SQL events (verbose)
PRISMA_LOG_EVENTS=1

# Filter to specific models
PRISMA_LOG_MODELS=EventSession,Merit
```

## Database Import/Export Scripts

### Sequence Reset After Import
When importing data with explicit IDs, PostgreSQL sequences can get out of sync:

```bash
# After running import-all.js, reset sequences
pnpm --filter @workspace/db exec node scripts/reset-sequences.js
```

**What it does**: Sets each auto-increment sequence to `MAX(id) + 1` to prevent duplicate key errors.

### Import Script Fixes
- **File**: `packages/database/scripts/import-all.js`
- **Fix**: MeritType imports now include all schema fields (`isEvent`, `displayIndex`, `minPercentPresent`, `minPercentNotMuted`)
- **Previous issue**: Backup restores were missing these fields, causing autocomplete to show no results
