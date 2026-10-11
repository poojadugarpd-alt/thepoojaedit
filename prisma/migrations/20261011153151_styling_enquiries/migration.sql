-- CreateEnum
CREATE TYPE "StylingEnquiryStatus" AS ENUM ('NEW', 'REPLIED', 'BOOKED', 'CLOSED');

-- AlterTable
ALTER TABLE "AdminNotificationPreference" ADD COLUMN     "stylingEnquiry" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "StylingEnquiry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "budget" TEXT,
    "message" TEXT NOT NULL,
    "status" "StylingEnquiryStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StylingEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StylingEnquiry_status_createdAt_idx" ON "StylingEnquiry"("status", "createdAt");

-- Private customer data: deny the Supabase Data API, same as every other table
-- (supabase/policies/01_lock_down_data_api.sql). ENABLE, not FORCE, so Prisma's
-- connection role is unaffected.
ALTER TABLE "StylingEnquiry" ENABLE ROW LEVEL SECURITY;
