"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";

export interface LatestNewOrder {
  /** AdminNotification id (uuid v7, so later = greater). */
  id: string;
  orderNumber: string;
  totalPaise: number;
  paymentMethod: string;
}

/**
 * The newest paid-order alert (D-147), for the admin's in-page "cha-ching".
 * Reads the NEW_ORDER admin notification the order-confirmed event already
 * writes, so the sound fires exactly when the phone push does. Test orders
 * (D-146) are skipped.
 */
export async function latestNewOrderAction(): Promise<LatestNewOrder | null> {
  await requireAdmin();
  const rows = await prisma.adminNotification.findMany({
    where: { type: "NEW_ORDER", entityType: "Order" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, entityId: true },
  });
  for (const n of rows) {
    const order = await prisma.order.findUnique({
      where: { id: n.entityId },
      select: {
        orderNumber: true,
        totalPaise: true,
        paymentMethod: true,
        isTest: true,
      },
    });
    if (order && !order.isTest) {
      return {
        id: n.id,
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
        paymentMethod: order.paymentMethod,
      };
    }
  }
  return null;
}
