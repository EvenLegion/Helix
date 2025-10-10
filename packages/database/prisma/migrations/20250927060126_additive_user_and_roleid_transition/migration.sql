/*
  Warnings:

  - You are about to alter the column `userID` on the `divisionMembership` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(19)`.
  - A unique constraint covering the columns `[userId,divisionId]` on the table `divisionMembership` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "arbiter"."DiscordRoles" ADD COLUMN     "roleId" TEXT;

-- AlterTable
ALTER TABLE "arbiter"."divisionMembership" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "userID" SET DATA TYPE VARCHAR(19);

-- CreateIndex
CREATE INDEX "divisionMembership_userId_idx" ON "arbiter"."divisionMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "divisionMembership_userId_divisionId_key" ON "arbiter"."divisionMembership"("userId", "divisionId");
