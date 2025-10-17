/*
  Warnings:

  - The primary key for the `merit` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "merit_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "merit_userID_idx" ON "arbiter"."merit"("userID");
