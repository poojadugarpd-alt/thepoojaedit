-- CreateEnum
CREATE TYPE "ReviewSite" AS ENUM ('STYLING', 'STUDIO');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('OPEN', 'INVITE');

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "site" "ReviewSite" NOT NULL,
    "service" TEXT NOT NULL,
    "rating" INTEGER,
    "text" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "instagram" TEXT,
    "showInstagram" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "consentPublish" BOOLEAN NOT NULL,
    "consentContact" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReviewSource" NOT NULL DEFAULT 'OPEN',
    "inviteId" UUID,
    "note" TEXT,
    "ipHash" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewInvite" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "site" "ReviewSite" NOT NULL,
    "service" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),
    "usedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ReviewInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_site_status_approvedAt_idx" ON "Review"("site", "status", "approvedAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_ipHash_createdAt_idx" ON "Review"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewInvite_token_key" ON "ReviewInvite"("token");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ReviewInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Private client data: deny the Supabase Data API, same as every other table
-- (supabase/policies/01_lock_down_data_api.sql). ENABLE, not FORCE, so Prisma's
-- connection role is unaffected.
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewInvite" ENABLE ROW LEVEL SECURITY;
