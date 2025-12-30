-- CreateTable
CREATE TABLE "nexus"."audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "organizationId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "nexus"."audit_log"("userId");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_idx" ON "nexus"."audit_log"("organizationId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "nexus"."audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "nexus"."audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "nexus"."audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
