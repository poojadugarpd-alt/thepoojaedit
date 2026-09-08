import "server-only";

/**
 * notifications domain service (master §8). Versioned template registry
 * (`./templates`), transports (`./transports`), delivery engine (`./service`).
 * SMS is absent by design. Channel failure is independent of order/payment
 * state; API acceptance is not delivery.
 */
import { prisma } from "@/lib/db";

import {
  applyDeliveryCallback,
  notifyForDomainEvent,
  retryNotification,
  sendNotification,
} from "./service";
import { getTransports } from "./transports";

export * from "./templates";
export {
  sendNotification,
  notifyForDomainEvent,
  applyDeliveryCallback,
  TemplateVariableError,
} from "./service";
export type { SendNotificationInput, SendOutcome, Transports } from "./service";

export function sendNotificationNow(
  input: Parameters<typeof sendNotification>[2],
) {
  return sendNotification(prisma, getTransports(prisma), input);
}

export function notifyForDomainEventNow(
  event: Parameters<typeof notifyForDomainEvent>[1],
) {
  return notifyForDomainEvent(prisma, event);
}

export function retryNotificationNow(input: { deliveryId: string; adminUserId: string }) {
  return retryNotification(prisma, getTransports(prisma), input);
}

export function applyDeliveryCallbackNow(
  input: Parameters<typeof applyDeliveryCallback>[1],
) {
  return applyDeliveryCallback(prisma, input);
}
