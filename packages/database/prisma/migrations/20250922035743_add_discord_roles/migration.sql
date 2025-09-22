/*
  Warnings:

  - You are about to drop the `merit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `merit_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `name_change_request` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_type_id_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."merit" DROP CONSTRAINT "merit_userID_fkey";

-- DropForeignKey
ALTER TABLE "arbiter"."name_change_request" DROP CONSTRAINT "name_change_request_userId_fkey";

-- DropForeignKey
ALTER TABLE "nexus"."account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "nexus"."session" DROP CONSTRAINT "session_userId_fkey";

-- DropTable
DROP TABLE "arbiter"."merit";

-- DropTable
DROP TABLE "arbiter"."merit_type";

-- DropTable
DROP TABLE "arbiter"."name_change_request";

-- DropTable
DROP TABLE "nexus"."account";

-- DropTable
DROP TABLE "nexus"."session";

-- DropTable
DROP TABLE "nexus"."user";

-- DropTable
DROP TABLE "nexus"."verification";

-- CreateTable
CREATE TABLE "nexus"."User"
(
    "id" TEXT NOT NULL,
    "username" TEXT,
    "nickname" TEXT,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."Session"
(
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."Account"
(
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."Verification"
(
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."NameChangeRequest"
(
    "id" SERIAL NOT NULL,
    "userId" CHAR(19) NOT NULL,
    "currentName" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "denyReason" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" CHAR(19),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NameChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."Merit"
(
    "userID" CHAR(19) NOT NULL,
    "merits" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "additonal_notes" VARCHAR(255) NOT NULL,
    "awarded_by" CHAR(19) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type_id" INTEGER NOT NULL,

    CONSTRAINT "Merit_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "arbiter"."MeritType"
(
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeritType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."DiscordRoles"
(
    "id" SERIAL NOT NULL,
    "role_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "hoist" BOOLEAN NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordRoles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "nexus"."Session"("token");

-- AddForeignKey
ALTER TABLE "nexus"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexus"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."NameChangeRequest" ADD CONSTRAINT "NameChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."Merit" ADD CONSTRAINT "Merit_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "arbiter"."MeritType"("id")
ON DELETE RESTRICT ON
UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."Merit" ADD CONSTRAINT "Merit_userID_fkey" FOREIGN KEY ("userID") REFERENCES "nexus"."User"("id")
ON DELETE RESTRICT ON
UPDATE CASCADE;
