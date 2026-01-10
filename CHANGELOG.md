# Changelog

All notable changes to this repository will be documented in this file.

## Unreleased

This file tracks cross-cutting changes only. For app/package-specific changes, see their local changelogs.

- apps/arbiter: see `apps/arbiter/CHANGELOG.md`
- packages/database: see `packages/database/CHANGELOG.md` (if present)

### Ops / Build
- Build remains driven by Turbo. Prisma `generate` is part of the pipeline; avoid running it manually unless needed for db scripts.
- To build only arbiter:
  - `pnpx turbo run build --filter arbiter`
- For dev with hot reload:
  - `pnpx turbo dev --filter arbiter`
- On Windows, if Prisma reports an EPERM rename on the query engine DLL, stop processes using the database (e.g., running app/dev servers), rerun the command, then restart dev.
