-- AlterTable
ALTER TABLE "arbiter"."meritType" ADD COLUMN     "minPercentNotMuted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minPercentPresent" INTEGER NOT NULL DEFAULT 0;
