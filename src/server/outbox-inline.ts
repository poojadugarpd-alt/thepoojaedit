import "server-only";

import { prisma } from "@/lib/db";
import { getDocumentStore } from "@/lib/documents";
import { logger } from "@/lib/logger";
import { dispatchPending, runOnce } from "@/server/events";
import type { OutboxMessage, OutboxTransport } from "@/server/events";
import { notifyForDomainEvent } from "@/server/notifications";
import { getPaymentProvider, isPrepaidConfigured } from "@/server/payments";
import { createInvoiceForOrder, generateInvoicePdf } from "@/server/invoices/service";
import { refundLateCaptureShortfall } from "@/server/refunds/service";
import {
  ensureShipmentForConfirmedOrder,
  getFulfilmentProvider,
  isShippingConfigured,
} from "@/server/shipping";

/**
 * In-process outbox consumers.
 *
 * Until now every dispatched domain event went out to Inngest, which fanned it
 * to five separate functions (notifications, invoice, shipment, late-capture
 * refund, a logger). Each of those is billed as an Inngest run even when it
 * just checks "is this my event?" and skips, and the dispatcher itself polled
 * every minute. That used the whole free-plan allowance (50,000 runs/month) in
 * about a week, after which Inngest stopped starting any job — no order
 * emails, no admin alerts, no phone push.
 *
 * Here the same consumers run directly in the app, straight after an order
 * event is written (see `scheduleInlineDispatch`), with no Inngest involved.
 * Every consumer is already idempotent (`runOnce` / per-delivery dedupe keys),
 * so a retry, or the Inngest safety-net job running the same dispatcher, can
 * never send anything twice.
 */

const CONFIRMATION_EVENTS = new Set([
  "order.payment_settled",
  "order.cod_confirmed",
  "order.confirmed",
]);

/** Runs every consumer for one event. A failing consumer never blocks the
 *  others; if any failed, throws at the end so the dispatcher retries the
 *  event with backoff (the consumers that already succeeded are deduped). */
export async function runInlineConsumers(message: OutboxMessage): Promise<void> {
  const { domainEventId, type, aggregateType, aggregateId, payload } = message;
  const failures: string[] = [];
  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error({ err: msg, consumer: name, type, aggregateId }, "outbox consumer failed");
      failures.push(`${name}: ${msg}`);
    }
  };

  // Customer + admin notifications first: they are what the owner is waiting on.
  await attempt("notify", () =>
    notifyForDomainEvent(prisma, { domainEventId, type, aggregateType, aggregateId, payload }),
  );

  if (aggregateType === "Order" && CONFIRMATION_EVENTS.has(type)) {
    if (isShippingConfigured()) {
      await attempt("shipment", () =>
        runOnce(prisma, {
          executionKey: `${domainEventId}:shipment`,
          handlerName: "ensure-shipment",
          eventId: domainEventId,
          run: async () => ({
            result: await ensureShipmentForConfirmedOrder(prisma, getFulfilmentProvider(), {
              orderId: aggregateId,
            }),
          }),
        }),
      );
    }

    await attempt("invoice", async () => {
      const invoice = await runOnce(prisma, {
        executionKey: `${domainEventId}:invoice`,
        handlerName: "issue-invoice",
        eventId: domainEventId,
        run: async () => {
          const inv = await createInvoiceForOrder(prisma, { orderId: aggregateId });
          return { result: { invoiceId: inv.id } };
        },
      });
      const invoiceId = (invoice as { result?: { invoiceId?: string } })?.result?.invoiceId;
      if (invoiceId) {
        const store = await getDocumentStore();
        await generateInvoicePdf(prisma, store, { invoiceId });
      }
    });
  }

  if (aggregateType === "Order" && type === "order.late_capture_review" && isPrepaidConfigured()) {
    await attempt("late-capture-refund", () =>
      runOnce(prisma, {
        executionKey: `${domainEventId}:late-capture-refund`,
        handlerName: "refund-late-capture",
        eventId: domainEventId,
        run: async () => ({
          result: await refundLateCaptureShortfall(prisma, getPaymentProvider(), {
            orderId: aggregateId,
          }),
        }),
      }),
    );
  }

  if (failures.length > 0) throw new Error(failures.join(" | "));
}

export const inlineTransport: OutboxTransport = { send: runInlineConsumers };

/** Claims and delivers whatever is pending, in this process. Safe to run from
 *  several places at once — claiming is lease-based (`FOR UPDATE SKIP LOCKED`). */
export function dispatchInline() {
  return dispatchPending(prisma, { transport: inlineTransport, owner: "inline" });
}
