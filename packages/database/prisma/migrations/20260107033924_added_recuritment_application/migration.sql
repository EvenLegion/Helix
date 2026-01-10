-- CreateTable
CREATE TABLE "nexus"."recruitment_application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rsiHandle" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "combatExperience" INTEGER NOT NULL,
    "logisticsExperience" INTEGER NOT NULL,
    "supportExperience" INTEGER NOT NULL,
    "starCitizenExperience" TEXT,
    "top3ShipsWhy" TEXT NOT NULL,
    "whenStartPlayingSC" TEXT NOT NULL,
    "whyJoin" TEXT NOT NULL,
    "canCommitToDiscord" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "recruitment_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recruitment_application_status_appliedAt_idx" ON "nexus"."recruitment_application"("status", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_application_userId_status_key" ON "nexus"."recruitment_application"("userId", "status");

-- AddForeignKey
ALTER TABLE "nexus"."recruitment_application" ADD CONSTRAINT "recruitment_application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
