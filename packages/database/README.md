# @workspace/db

Shared Prisma client for the Helix monorepo.

## What this package provides
- A singleton Prisma client exported as `prisma`
- Types that match the generated Prisma client (from this package’s schema)
- Optional Accelerate extension wiring and lightweight logging toggled via env vars

## Importing
- Use this package for both the client and types to ensure they match the generated schema.
- Do not import from `@prisma/client` directly in apps; types there may drift from our generated output.

Example:

```ts
import { prisma } from "@workspace/db";
// Types
import type { Prisma, DiscordRoles } from "@workspace/db";
```

## Environment behavior
- This package does not load `.env` files. It relies entirely on the process environment at runtime.
- Prisma will read `process.env.DATABASE_URL` set by the consuming app or the shell/OS.
- In monorepo dev, ensure your app loads `.env` (e.g., CommandKit, Next.js) before the first Prisma import.
- Note: An OS-level `DATABASE_URL` (e.g., on Windows) overrides `.env` values. Clear or fix it if you see the wrong DB.

## Schema changes and codegen
When you edit `packages/database/prisma/schema.prisma`:

- Regenerate the client:
  - `pnpx turbo run build --filter=@workspace/db` (or run any app build; Turbo will trigger `db:generate`)
- Consumers should rebuild or restart their dev task so TypeScript picks up updated types.

## Versions
- Prisma CLI and client versions are declared in this package. Keep them in sync to avoid drift.
- Consumers should not list `@prisma/client` in their deps; rely on `@workspace/db` instead.

## Development Tools

### Artificial Latency Simulation
For testing interaction timeouts and slow database conditions locally, the client supports configurable latency injection:

**Environment Variables:**
```bash
# Fixed delay for all queries
PRISMA_LATENCY_MS=800
PRISMA_LATENCY_PCT=100

# Random delay range (min-max in milliseconds)
PRISMA_LATENCY_RANGE=300-1500
PRISMA_LATENCY_PCT=60

# Limit to specific Prisma models
PRISMA_LATENCY_MODELS=User,EventSession,Merit
```

**Examples:**
```powershell
# Simulate slow cloud DB (75% of queries delayed 400-1200ms)
$env:PRISMA_LATENCY_RANGE='400-1200'; $env:PRISMA_LATENCY_PCT=75; pnpm dev

# Test extreme latency on specific models
$env:PRISMA_LATENCY_MS=2000; $env:PRISMA_LATENCY_MODELS='EventSession'; pnpm dev
```

### Enhanced Logging
Enable detailed operation logging for debugging:

```bash
# Middleware-based summary (recommended)
PRISMA_LOG_MW=1
PRISMA_SLOW_MS=200

# Raw SQL events with parameters (verbose)
PRISMA_LOG_EVENTS=1

# Filter logs to specific models
PRISMA_LOG_MODELS=EventSession,Merit
```

The logging shows operation type (READ/WRITE), model, action, duration, and result size.

## Database Utility Scripts

The database package includes several utility scripts for maintenance and troubleshooting. All scripts support dry-run mode by default for safety.

### User Management

#### Delete User and Related Records
Safely removes a user and all their related data while respecting foreign key constraints.

```bash
# Preview what would be deleted (dry-run mode)
pnpm --filter @workspace/db run db:delete-user <userId>

# Actually delete the user and all related records
pnpm --filter @workspace/db run db:delete-user <userId> --confirm_delete

# Alternative: use environment variable
CONFIRM_DELETE=1 pnpm --filter @workspace/db run db:delete-user <userId>
```

**What gets deleted:**
- Merit records
- Division memberships  
- Name change requests
- Event session participants
- Authentication accounts
- User sessions
- The user record itself

**Example:**
```bash
# Check what would be deleted for user ID 123456789012345678
pnpm --filter @workspace/db run db:delete-user 123456789012345678

# Actually delete after reviewing
pnpm --filter @workspace/db run db:delete-user 123456789012345678 --confirm_delete
```

### Data Integrity

#### Check Orphaned Records
Diagnose records with missing foreign key relationships:

```bash
pnpm --filter @workspace/db run db:check-orphaned-merits
```

#### Backfill Missing Users
Create minimal user records for orphaned merit entries:

```bash
pnpm --filter @workspace/db run db:backfill-orphaned-merits
```

### Import/Export

#### Full Database Backup and Restore
Export all database tables to timestamped JSON files:

```bash
# Export all data to packages/database/backups/YYYYMMDD-HHMMSS/
pnpm --filter @workspace/db run db:export-all
```

Import data from a backup directory:

```bash
# Import from a specific backup
pnpm --filter @workspace/db run db:import-all 20240315-143022

# Import from the latest backup
pnpm --filter @workspace/db run db:import-all latest

# Import from a custom directory path
pnpm --filter @workspace/db run db:import-all /path/to/backup/folder
```

**Complete restore workflow** (import + sequence reset + verification):

```bash
# One-command restore with automatic sequence fixing
pnpm --filter @workspace/db run db:restore latest
pnpm --filter @workspace/db run db:restore 20240315-143022
```

#### Merit Type Management
Selective backup/restore for merit types only:

```bash
# Export merit types to timestamped file
pnpm --filter @workspace/db run db:export-merit-types

# Import merit types from file
pnpm --filter @workspace/db run db:import-merit-types /path/to/merit-types-file.json
```

#### Sequence Management
After importing data with explicit IDs, PostgreSQL sequences can become out of sync:

```bash
# Reset all sequences to MAX(id) + 1
pnpm --filter @workspace/db run db:reset-sequences

# Verify sequence status without making changes
pnpm --filter @workspace/db run db:verify-sequences
```

**Important Notes:**
- Exports create timestamped folders to avoid overwrites
- Imports are idempotent - use upserts based on primary/natural keys
- Always run sequence reset after imports to prevent duplicate key errors
- The `db:restore` command handles the full workflow automatically

## Troubleshooting
- "Property X does not exist on type PrismaClient": ensure the consumer imports types from `@workspace/db` and has rebuilt after schema changes.
- Wrong database at runtime: print `process.env.DATABASE_URL` in the app (before importing `@workspace/db`), check for OS-level overrides, and confirm `.env` is loaded.
- Auto-increment conflicts after import: run `pnpm --filter @workspace/db exec node scripts/reset-sequences.js` to sync PostgreSQL sequences with actual data.
