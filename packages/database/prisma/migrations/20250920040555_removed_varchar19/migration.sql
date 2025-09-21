/*
  Warnings:

  - The primary key for the `merit` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_userID_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."name_change_request" DROP CONSTRAINT "name_change_request_userId_fkey";

-- DropForeignKey
ALTER TABLE "nexus"."invitation" DROP CONSTRAINT "invitation_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "nexus"."member" DROP CONSTRAINT "member_userId_fkey";

-- AlterTable
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_pkey",
ALTER COLUMN "userID" SET DATA TYPE TEXT,
ALTER COLUMN "awarded_by" SET DATA TYPE TEXT,
ADD CONSTRAINT "merit_pkey" PRIMARY KEY ("userID");

-- AlterTable
ALTER TABLE "arbiter"."name_change_request" ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "approvedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "nexus"."invitation" ALTER COLUMN "inviterId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "nexus"."member" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "arbiter"."name_change_request" ADD CONSTRAINT "name_change_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_userID_fkey" FOREIGN KEY ("userID") REFERENCES "nexus"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexus"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexus"."invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
