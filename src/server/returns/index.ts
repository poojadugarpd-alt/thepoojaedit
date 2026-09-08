import "server-only";

/**
 * returns domain service (master §7, §8). Lifecycle + inspection + explicitly
 * authorised restock (exactly once); refund on resolution goes through the
 * refunds workflow. This binds the shared Prisma client + payment provider.
 */
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/server/payments";

import {
  createReturnRequest,
  decideReturn,
  finalizeReturnInspection,
  inspectReturnItem,
  markReturnInTransit,
  markReturnReceived,
  resolveReturn,
} from "./service";

export * from "./service";

export function createReturnRequestNow(input: Parameters<typeof createReturnRequest>[1]) {
  return createReturnRequest(prisma, input);
}
export function decideReturnNow(input: Parameters<typeof decideReturn>[1]) {
  return decideReturn(prisma, input);
}
export function markReturnInTransitNow(input: Parameters<typeof markReturnInTransit>[1]) {
  return markReturnInTransit(prisma, input);
}
export function markReturnReceivedNow(input: Parameters<typeof markReturnReceived>[1]) {
  return markReturnReceived(prisma, input);
}
export function inspectReturnItemNow(input: Parameters<typeof inspectReturnItem>[1]) {
  return inspectReturnItem(prisma, input);
}
export function finalizeReturnInspectionNow(
  input: Parameters<typeof finalizeReturnInspection>[1],
) {
  return finalizeReturnInspection(prisma, input);
}
export function resolveReturnNow(input: Parameters<typeof resolveReturn>[2]) {
  return resolveReturn(prisma, getPaymentProvider(), input);
}
