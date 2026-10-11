-- CreateEnum
CREATE TYPE "LookStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Look" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "reelUrl" TEXT,
    "coverBucket" TEXT,
    "coverPath" TEXT,
    "coverUrl" TEXT,
    "coverAlt" TEXT NOT NULL DEFAULT '',
    "status" "LookStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Look_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookItem" (
    "id" UUID NOT NULL,
    "lookId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LookItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Look_slug_key" ON "Look"("slug");

-- CreateIndex
CREATE INDEX "Look_status_publishedAt_idx" ON "Look"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "LookItem_lookId_position_idx" ON "LookItem"("lookId", "position");

-- CreateIndex
CREATE INDEX "LookItem_productId_idx" ON "LookItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "LookItem_lookId_productId_key" ON "LookItem"("lookId", "productId");

-- AddForeignKey
ALTER TABLE "LookItem" ADD CONSTRAINT "LookItem_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "Look"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookItem" ADD CONSTRAINT "LookItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny the Supabase Data API like every other table
-- (supabase/policies/01_lock_down_data_api.sql). ENABLE, not FORCE.
ALTER TABLE "Look" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LookItem" ENABLE ROW LEVEL SECURITY;
