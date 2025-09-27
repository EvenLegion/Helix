-- CreateTable
CREATE TABLE "arbiter"."event_session" (
    "id" SERIAL NOT NULL,
    "guildId" CHAR(19) NOT NULL,
    "channelId" CHAR(19) NOT NULL,
    "startedBy" CHAR(19) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "event_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."event_session_participant" (
    "id" SERIAL NOT NULL,
    "eventSessionId" INTEGER NOT NULL,
    "userId" CHAR(19) NOT NULL,
    "totalSecondsPresent" INTEGER NOT NULL DEFAULT 0,
    "totalSecondsSpeaking" INTEGER NOT NULL DEFAULT 0,
    "lastJoinAt" TIMESTAMP(3),
    "lastSpeakAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_session_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."event" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "type_id" INTEGER NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."event_type" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_session_guildId_channelId_status_idx" ON "arbiter"."event_session"("guildId", "channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_session_participant_eventSessionId_userId_key" ON "arbiter"."event_session_participant"("eventSessionId", "userId");

-- AddForeignKey
ALTER TABLE "arbiter"."event_session_participant" ADD CONSTRAINT "event_session_participant_eventSessionId_fkey" FOREIGN KEY ("eventSessionId") REFERENCES "arbiter"."event_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."event" ADD CONSTRAINT "event_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "arbiter"."event_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
