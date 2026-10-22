-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "notifyOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductInterest" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductInterest_createdAt_idx" ON "ProductInterest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInterest_productId_email_key" ON "ProductInterest"("productId", "email");

-- AddForeignKey
ALTER TABLE "ProductInterest" ADD CONSTRAINT "ProductInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
