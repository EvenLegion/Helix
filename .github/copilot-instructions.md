# Helix - AI Coding Agent Instructions

## Project Overview

Helix is a **Turborepo monorepo** containing two main applications:
- **Nexus**: Next.js 15 web application (website/admin dashboard)
- **Arbiter**: Discord.js bot using CommandKit framework

Both share a **unified PostgreSQL database** with multi-schema architecture (`nexus` and `arbiter` schemas) managed by Prisma ORM.

## Architecture & Data Flow

### Database Architecture
- **Single Prisma schema** at `packages/database/prisma/schema.prisma` with two PostgreSQL schemas
- User model is the **central entity** shared between both apps
- Discord ID is used as the primary key for `User` (enables seamless integration)
- Prisma Client generated to `packages/database/generated/prisma`
- Import database via: `import { prisma } from "@workspace/db"`

### Monorepo Structure
```
@workspace/db       → Shared Prisma client (packages/database)
@workspace/ui       → Shared React/Radix UI components (packages/ui)
@workspace/eslint-config → Shared ESLint configs
@workspace/typescript-config → Shared TypeScript configs
```

### Authentication & Authorization (Nexus)
- **Better-Auth** for authentication with Discord OAuth2
- Custom RBAC system using `better-auth/plugins/access` for role-based permissions
- Organization-based multi-tenancy with dynamic access control
- Middleware protects `/admin/*` routes via session cookies
- Auth config: `apps/nexus/lib/auth.ts`
- Client auth: `apps/nexus/lib/auth-client.ts`
- Permission statements: `apps/nexus/lib/auth/permissions.ts`
- Discord profile → User ID mapping happens in `mapProfileToUser`

### Key Integration Points
1. **Discord ↔ Database**: Arbiter bot interacts with same DB as Nexus
2. **Better-Auth hooks**: `databaseHooks` update user data from Discord API
3. **Session management**: Active organization stored in session on login
4. **Shared UI components**: Nexus imports from `@workspace/ui`

## Development Workflows

### Essential Commands
```bash
# Install dependencies (ALWAYS use pnpm)
pnpm install

# Development (runs all apps in parallel)
pnpm dev

# Development for specific app
turbo dev --filter=nexus
turbo dev --filter=arbiter

# Build all apps
pnpm build

# Database operations (run from packages/database or root)
pnpm db:generate    # Generate Prisma Client (required after schema changes)
pnpm db:migrate     # Create and apply migrations
pnpm db:deploy      # Deploy migrations (production)

# Lint & format
pnpm lint
pnpm format
```

### Database Development Workflow
1. Modify `packages/database/prisma/schema.prisma`
2. Run `pnpm db:generate` to regenerate client
3. Run `pnpm db:migrate` to create migration
4. Turbo build pipeline automatically runs `db:generate` before building apps

### Docker Compose
- PostgreSQL 16 runs locally via `docker-compose.yml`
- Default credentials: `nexususer` / `nexuspassword` / `nexusdb`
- Port: `5432`
- Data persisted in `./data` directory

## Project Conventions

### Import Aliases
- `@/` → App-specific src directory (e.g., `apps/nexus/`)
- `@workspace/db` → Database package
- `@workspace/ui` → UI component library

### Component Patterns (Nexus)
1. **Server Actions**: Place in `apps/nexus/server/*.ts`
2. **Forms**: Use react-hook-form + zod validation in `components/forms/`
3. **UI Components**: Import from `@workspace/ui/components/*`
4. **Shadcn/ui style**: All UI components follow Radix UI + CVA patterns
5. **Dialog Pattern**: See `components/admin/add-role.tsx` - wrap forms in Dialog with DialogTrigger

### Discord Bot (Arbiter)
- CommandKit auto-discovers commands in `apps/arbiter/src/app/commands/`
- Events in `apps/arbiter/src/app/events/`
- Client initialized in `apps/arbiter/src/app.ts`
- Required intents: Guilds, GuildMembers, GuildMessages, MessageContent, GuildMessageReactions

### Styling
- **Tailwind CSS 4** (CSS-first configuration)
- Global styles: `packages/ui/src/styles/globals.css`
- Theme provider with dark mode support
- CSS variables for sidebar/header dimensions

### Environment Variables
Required in `apps/nexus/env-development`:
- `DATABASE_URL`
- `GUILD_ID` (Discord server ID)
- `BETTER_AUTH_SECRET`
- `BASE_URL`
- `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`
- `DISCORD_TOKEN` (for Arbiter)

## Critical Patterns

### User Role Management
- Roles stored in `Member.role` (organization-scoped)
- Global permissions via `OrganizationRole` table
- Use `ac` (access control) from `lib/auth/permissions.ts` to define role statements
- Check permissions client-side with `authClient.organization.hasPermission()`

### Multi-Schema Prisma
- Always specify `@@schema("nexus")` or `@@schema("arbiter")` in models
- Use `schemas: ["arbiter", "nexus"]` in datasource config
- Both apps import same Prisma client from `@workspace/db`

### Turbo Pipeline
- `build` depends on `^build` and `^db:generate`
- `dev` depends on `^db:generate`
- Persistent tasks: `db:migrate`, `dev`
- No caching for database tasks

## Common Gotchas

1. **Always run `pnpm db:generate`** after Prisma schema changes before building
2. **Use `pnpm`** not npm/yarn - enforced by `packageManager` field
3. **Discord user ID** must match database User.id for auth to work
4. **Better-Auth requires `nextCookies()` plugin** for Next.js App Router
5. **Sidebar/layout** is configured in root layout with CSS custom properties
6. **Forms need "use client"** directive for react-hook-form
7. **Workspace imports** must use `@workspace/*` not relative paths across packages

## Testing & Debugging

- No test framework currently configured
- Use `pnpm check-types` for TypeScript validation
- Database inspection: Connect to `localhost:5432` with PostgreSQL client
- Auth debugging: Check `better-auth` logs in console and database `session`/`account` tables
- Discord bot: Check terminal output for CommandKit discovery logs
