-- AlterTable
ALTER TABLE "arbiter"."event_session" ADD COLUMN     "rootSessionId" INTEGER;

-- CreateIndex
CREATE INDEX "event_session_rootSessionId_status_idx" ON "arbiter"."event_session"("rootSessionId", "status");

-- AddForeignKey
ALTER TABLE "arbiter"."event_session" ADD CONSTRAINT "event_session_rootSessionId_fkey" FOREIGN KEY ("rootSessionId") REFERENCES "arbiter"."event_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
