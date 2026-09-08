import "server-only";

/**
 * refunds domain service (master §6, §8). Workflow over the payments-domain
 * `createOrderRefund` primitive: admin request, `refund.completed` event,
 * credit note, and provider reconciliation. No inventory side effects.
 */
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/server/payments";

import { requestRefund, type RequestRefundInput } from "./service";

export { makeRefundReconcilePort, requestRefund } from "./service";
export type { RequestRefundInput } from "./service";

export function requestRefundNow(input: RequestRefundInput) {
  return requestRefund(prisma, getPaymentProvider(), input);
}
