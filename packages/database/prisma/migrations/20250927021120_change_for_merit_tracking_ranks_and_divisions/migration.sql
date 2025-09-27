/*
  Warnings:

  - You are about to drop the `Merit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MeritType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NameChangeRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."Merit" DROP CONSTRAINT "Merit_type_id_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."Merit" DROP CONSTRAINT "Merit_userID_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."NameChangeRequest" DROP CONSTRAINT "NameChangeRequest_userId_fkey";

-- DropTable
DROP TABLE "arbiter"."Merit";

-- DropTable
DROP TABLE "arbiter"."MeritType";

-- DropTable
DROP TABLE "arbiter"."NameChangeRequest";

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
CREATE TABLE "arbiter"."merit" (
    "userID" VARCHAR(19) NOT NULL,
    "merits" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "additionalNotes" VARCHAR(255) NOT NULL,
    "awardedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typeId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merit_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "arbiter"."meritType" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "value" INTEGER NOT NULL,
    "displayIndex" INTEGER NOT NULL DEFAULT 0,
    "minPercentPresent" INTEGER NOT NULL DEFAULT 0,
    "minPercentNotMuted" INTEGER NOT NULL DEFAULT 0,
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
    "awardDescription" VARCHAR(255),

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
CREATE TABLE "arbiter"."event" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "typeId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "arbiter"."division" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nicknamePrefix" TEXT,
    "showRank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."rankLevel" (
    "level" INTEGER NOT NULL,
    "cumulativeMerits" INTEGER NOT NULL,

    CONSTRAINT "rankLevel_pkey" PRIMARY KEY ("level")
);

-- CreateTable
CREATE TABLE "arbiter"."divisionMembership" (
    "id" SERIAL NOT NULL,
    "userID" TEXT NOT NULL,
    "divisionId" INTEGER NOT NULL,
    "lastComputedLevel" INTEGER,
    "lastComputedAt" TIMESTAMP(3),
    "lastAppliedNicknameLevel" INTEGER,
    "lastNicknameUpdatedAt" TIMESTAMP(3),
    "nicknameSyncStatus" TEXT,
    "notes" TEXT,

    CONSTRAINT "divisionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventSession_guildId_channelId_status_idx" ON "arbiter"."eventSession"("guildId", "channelId", "status");

-- CreateIndex
CREATE INDEX "eventSession_rootSessionId_status_idx" ON "arbiter"."eventSession"("rootSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "eventSessionParticipant_eventSessionId_userId_key" ON "arbiter"."eventSessionParticipant"("eventSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "division_code_key" ON "arbiter"."division"("code");

-- CreateIndex
CREATE INDEX "divisionMembership_userID_idx" ON "arbiter"."divisionMembership"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "divisionMembership_userID_divisionId_key" ON "arbiter"."divisionMembership"("userID", "divisionId");

-- AddForeignKey
ALTER TABLE "arbiter"."nameChangeRequest" ADD CONSTRAINT "nameChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."meritType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_userID_fkey" FOREIGN KEY ("userID") REFERENCES "nexus"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSession" ADD CONSTRAINT "eventSession_meritTypeId_fkey" FOREIGN KEY ("meritTypeId") REFERENCES "arbiter"."meritType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSession" ADD CONSTRAINT "eventSession_rootSessionId_fkey" FOREIGN KEY ("rootSessionId") REFERENCES "arbiter"."eventSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."eventSessionParticipant" ADD CONSTRAINT "eventSessionParticipant_eventSessionId_fkey" FOREIGN KEY ("eventSessionId") REFERENCES "arbiter"."eventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."event" ADD CONSTRAINT "event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "arbiter"."eventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."divisionMembership" ADD CONSTRAINT "divisionMembership_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "arbiter"."division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
