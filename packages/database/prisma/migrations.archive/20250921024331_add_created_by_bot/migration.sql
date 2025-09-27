-- AlterTable
ALTER TABLE "arbiter"."event_session" ADD COLUMN     "createdByBot" BOOLEAN NOT NULL DEFAULT false;
