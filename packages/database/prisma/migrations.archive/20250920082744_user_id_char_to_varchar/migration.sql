/*
  Warnings:

  - The primary key for the `merit` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_userID_fkey";

-- AlterTable
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_pkey",
ALTER COLUMN "userID" SET DATA TYPE VARCHAR(19),
ADD CONSTRAINT "merit_pkey" PRIMARY KEY ("userID");

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_userID_fkey" FOREIGN KEY ("userID") REFERENCES "nexus"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
