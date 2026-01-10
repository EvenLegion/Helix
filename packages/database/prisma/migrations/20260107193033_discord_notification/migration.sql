-- AlterTable
ALTER TABLE "nexus"."recruitment_application" ADD COLUMN     "orgnaizationId" TEXT;

-- CreateTable
CREATE TABLE "nexus"."discord_notification_queue" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discord_notification_queue_status_createdAt_idx" ON "nexus"."discord_notification_queue"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "nexus"."recruitment_application" ADD CONSTRAINT "recruitment_application_orgnaizationId_fkey" FOREIGN KEY ("orgnaizationId") REFERENCES "nexus"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
