/*
  Warnings:

  - You are about to drop the column `orgnaizationId` on the `recruitment_application` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "nexus"."recruitment_application" DROP CONSTRAINT "recruitment_application_orgnaizationId_fkey";

-- AlterTable
ALTER TABLE "nexus"."recruitment_application" DROP COLUMN "orgnaizationId",
ADD COLUMN     "organizationId" TEXT;

-- AddForeignKey
ALTER TABLE "nexus"."recruitment_application" ADD CONSTRAINT "recruitment_application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "nexus"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
