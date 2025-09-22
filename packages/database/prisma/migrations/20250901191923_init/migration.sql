-- CreateSchema
CREATE SCHEMA
IF NOT EXISTS "arbiter";

-- CreateSchema
CREATE SCHEMA
IF NOT EXISTS "nexus";

-- CreateTable
CREATE TABLE "nexus"."user"
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

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."session"
(
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."account"
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

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexus"."verification"
(
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."name_change_request"
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

    CONSTRAINT "name_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbiter"."merit"
(
    "userID" CHAR(19) NOT NULL,
    "merits" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "additonal_notes" VARCHAR(255) NOT NULL,
    "awarded_by" CHAR(19) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type_id" INTEGER NOT NULL,

    CONSTRAINT "merit_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "arbiter"."merit_type"
(
    "id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merit_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "nexus"."session"("token");

-- AddForeignKey
ALTER TABLE "nexus"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nexus"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."name_change_request" ADD CONSTRAINT "name_change_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "nexus"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "arbiter"."merit_type"("id")
ON DELETE RESTRICT ON
UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbiter"."merit" ADD CONSTRAINT "merit_userID_fkey" FOREIGN KEY ("userID") REFERENCES "nexus"."user"("id")
ON DELETE RESTRICT ON
UPDATE CASCADE;
