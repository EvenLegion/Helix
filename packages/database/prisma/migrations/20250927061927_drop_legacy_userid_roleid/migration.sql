/*
  Warnings:

  - You are about to drop the column `role_id` on the `DiscordRoles` table. All the data in the column will be lost.
  - You are about to drop the column `userID` on the `divisionMembership` table. All the data in the column will be lost.
  - You are about to alter the column `userId` on the `divisionMembership` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(19)`.
  - Made the column `roleId` on table `DiscordRoles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `divisionMembership` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "arbiter"."divisionMembership_userID_divisionId_key";

-- DropIndex
DROP INDEX "arbiter"."divisionMembership_userID_idx";

-- AlterTable
ALTER TABLE "arbiter"."DiscordRoles" DROP COLUMN "role_id",
ALTER COLUMN "roleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "arbiter"."divisionMembership" DROP COLUMN "userID",
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(19);
