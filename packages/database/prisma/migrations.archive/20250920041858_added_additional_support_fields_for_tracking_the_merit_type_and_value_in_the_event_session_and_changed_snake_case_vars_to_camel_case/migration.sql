/*
  Warnings:

  - Added the required column `value` to the `merit_type` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "arbiter"."event_session" ADD COLUMN     "merit_type_id" INTEGER;

-- AlterTable
ALTER TABLE "arbiter"."merit_type" ADD COLUMN     "value" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "arbiter"."event_session" ADD CONSTRAINT "event_session_merit_type_id_fkey" FOREIGN KEY ("merit_type_id") REFERENCES "arbiter"."merit_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;
