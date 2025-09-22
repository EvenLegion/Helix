/*
  Warnings:

  - Added the required column `permissions` to the `DiscordRoles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "arbiter"."DiscordRoles" ADD COLUMN     "permissions" TEXT NOT NULL;
