/*
  Warnings:

  - You are about to drop the `event_session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event_session_participant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `merit_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `name_change_request` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."event" DROP CONSTRAINT "event_typeId_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."event_session" DROP CONSTRAINT "event_session_meritTypeId_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."event_session" DROP CONSTRAINT "event_session_rootSessionId_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."event_session_participant" DROP CONSTRAINT "event_session_participant_eventSessionId_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_typeId_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."name_change_request" DROP CONSTRAINT "name_change_request_userId_fkey";

-- DropTable
DROP TABLE "arbiter"."event_session";

-- DropTable
DROP TABLE "arbiter"."event_session_participant";

-- DropTable
DROP TABLE "arbiter"."event_type";

-- DropTable
DROP TABLE "arbiter"."merit_type";

-- DropTable
DROP TABLE "arbiter"."name_change_request";

-- CreateTable
CREATE TABLE "arbiter"."nameChangeRequest" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "currentName" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "denyReason" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nameChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."meritType" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meritType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."eventSession" (
    "id" SERIAL NOT NULL,
    "rootSessionId" INTEGER,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdByBot" BOOLEAN NOT NULL DEFAULT false,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "meritTypeId" INTEGER,

    CONSTRAINT "eventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."eventSessionParticipant" (
    "id" SERIAL NOT NULL,
    "eventSessionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSecondsPresent" INTEGER NOT NULL DEFAULT 0,
    "totalSecondsSpeaking" INTEGER NOT NULL DEFAULT 0,
    "lastJoinAt" TIMESTAMP(3),
    "lastSpeakAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."eventType" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventSession_guildId_channelId_status_idx" ON "arbiter"."eventSession"("guildId", "channelId", "status");

-- CreateIndex
CREATE INDEX "eventSession_rootSessionId_status_idx" ON "arbiter"."eventSession"("rootSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eventSessionParticipant_eventSessionId_userId_key" ON "arbiter"."eventSessionParticipant"("eventSessionId", "userId");

-- AddForeignKey
ALTER TABLE "arbiter"."nameChangeRequest" ADD CONSTRAINT "nameChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."meritType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSession" ADD CONSTRAINT "eventSession_rootSessionId_fkey" FOREIGN KEY ("rootSessionId") REFERENCES "arbiter"."eventSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSession" ADD CONSTRAINT "eventSession_meritTypeId_fkey" FOREIGN KEY ("meritTypeId") REFERENCES "arbiter"."meritType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSessionParticipant" ADD CONSTRAINT "eventSessionParticipant_eventSessionId_fkey" FOREIGN KEY ("eventSessionId") REFERENCES "arbiter"."eventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."event" ADD CONSTRAINT "event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."eventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
