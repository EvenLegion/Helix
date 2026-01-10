# Database Changelog

All notable changes to the Database package will be documented in this file.

## Unreleased

### Schema Migrations
- Migration: `20251019213628_event_review_finalization_and_merit_unique`
  - Table `arbiter.eventSession`:
    - Add `reviewFinalizedAt` TIMESTAMP(3)
    - Add `reviewFinalizedBy` TEXT
  - Table `arbiter.merit`:
    - Create unique index `merit_userID_typeId_additionalNotes_key` on `(userID, typeId, additionalNotes)` to enforce idempotency and prevent duplicate awards.
    - Note: If duplicates already exist, this index creation will fail; clean or dedupe before deploying.

### Notes
- Prisma generate is invoked by the Turbo pipeline as part of builds; no manual `prisma generate` is required for standard builds.
- Deploying migrations:
  - Local/dev: `prisma migrate dev --skip-generate`
  - Prod/CI: `prisma migrate deploy`