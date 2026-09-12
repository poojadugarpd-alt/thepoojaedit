-- CreateTable
CREATE TABLE "AdminPushSubscription" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotificationPreference" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "newPaidOrder" BOOLEAN NOT NULL DEFAULT true,
    "codConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "paymentIssue" BOOLEAN NOT NULL DEFAULT true,
    "shipmentFailure" BOOLEAN NOT NULL DEFAULT true,
    "ndrRto" BOOLEAN NOT NULL DEFAULT true,
    "jobExhausted" BOOLEAN NOT NULL DEFAULT true,
    "lowStock" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AdminNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminPushSubscription_endpoint_key" ON "AdminPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "AdminPushSubscription_adminUserId_idx" ON "AdminPushSubscription"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationPreference_adminUserId_key" ON "AdminNotificationPreference"("adminUserId");

-- AddForeignKey
ALTER TABLE "AdminPushSubscription" ADD CONSTRAINT "AdminPushSubscription_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotificationPreference" ADD CONSTRAINT "AdminNotificationPreference_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
