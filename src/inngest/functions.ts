import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  dispatchPending,
  runOnce,
  runReconciliation,
  runReservationSweep,
  runStaleOutboxAlert,
} from "@/server/events";
import {
  getPaymentProvider,
  isPrepaidConfigured,
  makePaymentReconcilePort,
} from "@/server/payments";
import {
  ensureShipmentForConfirmedOrder,
  getFulfilmentProvider,
  isShippingConfigured,
  makeShipmentReconcilePort,
} from "@/server/shipping";
import { getDocumentStore } from "@/lib/documents";
import {
  createInvoiceForOrder,
  generateInvoicePdf,
} from "@/server/invoices/service";
import { makeRefundReconcilePort } from "@/server/refunds/service";
import { notifyForDomainEvent } from "@/server/notifications";

import { inngest } from "./client";
import { inngestTransport } from "./transport";

/**
 * Required recurring work (master §8): outbox dispatch/recovery, reservation
 * expiry, stale/failed operation alerts, payment reconciliation, shipment
 * reconciliation. Schedules are documented in docs/operations-runbook.md.
 */

export const dispatchOutbox = inngest.createFunction(
  { id: "dispatch-outbox", concurrency: 1 },
  { cron: "* * * * *" },
  async ({ step }) => {
    const summary = await step.run("dispatch", () =>
      dispatchPending(prisma, {
        transport: inngestTransport,
        owner: "cron:dispatch-outbox",
      }),
    );
    if (summary.exhausted > 0 || summary.retried > 0) {
      logger.warn(summary, "outbox dispatch had failures");
    }
    return summary;
  },
);

export const sweepReservations = inngest.createFunction(
  { id: "sweep-reservations", concurrency: 1 },
  { cron: "*/2 * * * *" },
  async ({ step }) => step.run("sweep", () => runReservationSweep(prisma)),
);

export const outboxHealth = inngest.createFunction(
  { id: "outbox-health", concurrency: 1 },
  { cron: "*/10 * * * *" },
  async ({ step }) => step.run("check", () => runStaleOutboxAlert(prisma)),
);

/**
 * Poll Razorpay for payment attempts stuck in a non-terminal state (missed or
 * dropped webhooks — master §8 "Reconcile pending/ambiguous payments
 * periodically"). No-ops when Razorpay keys are absent in this environment.
 */
export const reconcilePayments = inngest.createFunction(
  { id: "reconcile-payments", concurrency: 1 },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    if (!isPrepaidConfigured()) return { skipped: "razorpay not configured" };
    return step.run("reconcile", () =>
      runReconciliation([makePaymentReconcilePort(prisma, getPaymentProvider())]),
    );
  },
);

/**
 * Poll Shadowfax for shipments still moving through the network, to catch missed
 * or dropped tracking callbacks (master §8, v1.1). No-op without credentials.
 */
export const reconcileShipments = inngest.createFunction(
  { id: "reconcile-shipments", concurrency: 1 },
  { cron: "*/10 * * * *" },
  async ({ step }) => {
    if (!isShippingConfigured()) return { skipped: "shadowfax not configured" };
    return step.run("reconcile", () =>
      runReconciliation([makeShipmentReconcilePort(prisma, getFulfilmentProvider())]),
    );
  },
);

/**
 * When an order becomes CONFIRMED (prepaid captured or COD confirmed), create
 * its Shadowfax shipment. Idempotent via the unique `merchantReference`; a
 * separate consumer of the same `poojaedit/outbox.dispatched` event so it can be
 * retried independently of the recorder below.
 */
export const createShipmentOnConfirm = inngest.createFunction(
  { id: "create-shipment-on-confirm", retries: 4, concurrency: 4 },
  { event: "poojaedit/outbox.dispatched" },
  async ({ event, step }) => {
    const { domainEventId, type, aggregateType, aggregateId } = event.data as {
      domainEventId: string;
      type: string;
      aggregateType: string;
      aggregateId: string;
    };
    const RELEVANT = new Set([
      "order.payment_settled",
      "order.cod_confirmed",
      "order.confirmed",
    ]);
    if (aggregateType !== "Order" || !RELEVANT.has(type)) {
      return { skipped: "not a confirmation event" };
    }
    if (!isShippingConfigured()) return { skipped: "shadowfax not configured" };

    return step.run("ensure-shipment", () =>
      runOnce(prisma, {
        executionKey: `${domainEventId}:shipment`,
        handlerName: "ensure-shipment",
        eventId: domainEventId,
        run: async () => {
          const r = await ensureShipmentForConfirmedOrder(
            prisma,
            getFulfilmentProvider(),
            { orderId: aggregateId },
          );
          return { result: r };
        },
      }),
    );
  },
);

/**
 * Poll Razorpay for refunds stuck non-terminal (master §8 — "unknown refund
 * outcome reconciled"). No-op without Razorpay keys.
 */
export const reconcileRefunds = inngest.createFunction(
  { id: "reconcile-refunds", concurrency: 1 },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    if (!isPrepaidConfigured()) return { skipped: "razorpay not configured" };
    return step.run("reconcile", () =>
      runReconciliation([makeRefundReconcilePort(prisma, getPaymentProvider())]),
    );
  },
);

/**
 * Issue the invoice + generate its private PDF when an order is CONFIRMED
 * (master §6). Idempotent (`Invoice @@unique([orderId])` + PDF key check).
 * A PDF failure opens an `INVOICE_FAILURE` task and is retried — it never
 * touches order/payment state.
 */
export const generateInvoice = inngest.createFunction(
  { id: "generate-invoice", retries: 4, concurrency: 4 },
  { event: "poojaedit/outbox.dispatched" },
  async ({ event, step }) => {
    const { domainEventId, type, aggregateType, aggregateId } = event.data as {
      domainEventId: string;
      type: string;
      aggregateType: string;
      aggregateId: string;
    };
    if (
      aggregateType !== "Order" ||
      !["order.payment_settled", "order.cod_confirmed", "order.confirmed"].includes(type)
    ) {
      return { skipped: "not a confirmation event" };
    }
    const invoice = await step.run("issue-invoice", () =>
      runOnce(prisma, {
        executionKey: `${domainEventId}:invoice`,
        handlerName: "issue-invoice",
        eventId: domainEventId,
        run: async () => {
          const inv = await createInvoiceForOrder(prisma, { orderId: aggregateId });
          return { result: { invoiceId: inv.id } };
        },
      }),
    );
    const invoiceId = (
      invoice as { result?: { invoiceId?: string } }
    )?.result?.invoiceId;
    if (!invoiceId) return { skipped: "no invoice id (deduped)" };
    return step.run("render-pdf", async () => {
      const store = await getDocumentStore();
      return generateInvoicePdf(prisma, store, { invoiceId });
    });
  },
);

/**
 * Send the customer + admin notifications for a dispatched domain event
 * (master §8). Independent consumer of `poojaedit/outbox.dispatched`; channel
 * failure never affects order/payment state. `runOnce` + per-delivery keys give
 * double dedup.
 */
export const sendNotifications = inngest.createFunction(
  // 5 is the Inngest free-plan per-function concurrency ceiling — a sync
  // rejects anything higher (found live 2026-09-11, D-97).
  { id: "send-notifications", retries: 3, concurrency: 5 },
  { event: "poojaedit/outbox.dispatched" },
  async ({ event, step }) => {
    const { domainEventId, type, aggregateType, aggregateId, payload } = event.data as {
      domainEventId: string;
      type: string;
      aggregateType: string;
      aggregateId: string;
      payload: unknown;
    };
    return step.run("notify", () =>
      notifyForDomainEvent(prisma, {
        domainEventId,
        type,
        aggregateType,
        aggregateId,
        payload,
      }),
    );
  },
);

/**
 * Consumer for every dispatched domain event. `step.run` gives durable retry;
 * `runOnce` adds cross-redelivery dedup keyed on the domain event.
 */
export const onOutboxDispatched = inngest.createFunction(
  { id: "on-outbox-dispatched", retries: 4 },
  { event: "poojaedit/outbox.dispatched" },
  async ({ event, step }) => {
    const { domainEventId, type, aggregateId } = event.data as {
      domainEventId: string;
      type: string;
      aggregateId: string;
    };
    return step.run("record", () =>
      runOnce(prisma, {
        executionKey: `${domainEventId}:record`,
        handlerName: "record-domain-event",
        eventId: domainEventId,
        run: async () => {
          logger.info({ type, aggregateId }, "domain event consumed");
          return { result: { recorded: true } };
        },
      }),
    );
  },
);

export const functions = [
  dispatchOutbox,
  sweepReservations,
  outboxHealth,
  reconcilePayments,
  reconcileShipments,
  reconcileRefunds,
  createShipmentOnConfirm,
  generateInvoice,
  sendNotifications,
  onOutboxDispatched,
];
