/*
  Warnings:

  - A unique constraint covering the columns `[userID,typeId,additionalNotes]` on the table `merit` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "arbiter"."eventSession" ADD COLUMN     "reviewFinalizedAt" TIMESTAMP(3),
ADD COLUMN     "reviewFinalizedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "merit_userID_typeId_additionalNotes_key" ON "arbiter"."merit"("userID", "typeId", "additionalNotes");
