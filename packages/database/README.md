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

## Troubleshooting
- “Property X does not exist on type PrismaClient”: ensure the consumer imports types from `@workspace/db` and has rebuilt after schema changes.
- Wrong database at runtime: print `process.env.DATABASE_URL` in the app (before importing `@workspace/db`), check for OS-level overrides, and confirm `.env` is loaded.
