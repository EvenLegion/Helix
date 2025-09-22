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
CREATE UNIQUE INDEX "division_code_key" ON "arbiter"."division"("code");

-- CreateIndex
CREATE INDEX "divisionMembership_userID_idx" ON "arbiter"."divisionMembership"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "divisionMembership_userID_divisionId_key" ON "arbiter"."divisionMembership"("userID", "divisionId");

-- AddForeignKey
ALTER TABLE "arbiter"."divisionMembership" ADD CONSTRAINT "divisionMembership_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "arbiter"."division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
