/*
  Warnings:

  - You are about to drop the column `created_at` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `event_date` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `type_id` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `event` table. All the data in the column will be lost.
  - You are about to drop the column `merit_type_id` on the `event_session` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `event_type` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `event_type` table. All the data in the column will be lost.
  - You are about to drop the column `additonal_notes` on the `merit` table. All the data in the column will be lost.
  - You are about to drop the column `awarded_by` on the `merit` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `merit` table. All the data in the column will be lost.
  - You are about to drop the column `type_id` on the `merit` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `merit` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `merit_type` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `merit_type` table. All the data in the column will be lost.
  - Added the required column `eventDate` to the `event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `typeId` to the `event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `event_type` table without a default value. This is not possible if the table is not empty.
  - Added the required column `additionalNotes` to the `merit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `awardedBy` to the `merit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `typeId` to the `merit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `merit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `merit_type` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."event" DROP CONSTRAINT "event_type_id_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."event_session" DROP CONSTRAINT "event_session_merit_type_id_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_type_id_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."name_change_request" DROP CONSTRAINT "name_change_request_userId_fkey";

-- AlterTable
ALTER TABLE "arbiter"."event" DROP COLUMN "created_at",
DROP COLUMN "event_date",
DROP COLUMN "type_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "eventDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "typeId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "arbiter"."event_session" DROP COLUMN "merit_type_id",
ADD COLUMN     "meritTypeId" INTEGER,
ALTER COLUMN "guildId" SET DATA TYPE TEXT,
ALTER COLUMN "channelId" SET DATA TYPE TEXT,
ALTER COLUMN "startedBy" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "arbiter"."event_session_participant" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "arbiter"."event_type" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "arbiter"."merit" DROP COLUMN "additonal_notes",
DROP COLUMN "awarded_by",
DROP COLUMN "created_at",
DROP COLUMN "type_id",
DROP COLUMN "updated_at",
ADD COLUMN     "additionalNotes" VARCHAR(255) NOT NULL,
ADD COLUMN     "awardedBy" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "typeId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "arbiter"."merit_type" DROP COLUMN "created_at",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "arbiter"."name_change_request" ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "approvedBy" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "arbiter"."name_change_request" ADD CONSTRAINT "name_change_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."merit_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."event_session" ADD CONSTRAINT "event_session_meritTypeId_fkey" FOREIGN KEY ("meritTypeId") REFERENCES "arbiter"."merit_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."event" ADD CONSTRAINT "event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."event_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
