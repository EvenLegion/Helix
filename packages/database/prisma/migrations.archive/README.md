This folder archives migrations that we intentionally removed from the active Prisma migration history.

- Prisma only considers migrations in `prisma/migrations/`.
- Anything moved here is ignored by Prisma but kept in git history.
- Only archive migrations that have NOT been applied to any environments, or after resolving with `prisma migrate resolve`.
