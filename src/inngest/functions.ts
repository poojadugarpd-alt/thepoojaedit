import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  dispatchPending,
  runOnce,
  runReservationSweep,
  runStaleOutboxAlert,
} from "@/server/events";

import { inngest } from "./client";
import { inngestTransport } from "./transport";

/**
 * Required recurring work (master §8): outbox dispatch/recovery, reservation
 * expiry, stale/failed operation alerts. Payment/shipment reconciliation
 * schedules are added in Phase 7/8 behind the ReconcilePort interface.
 * Schedules are documented in docs/operations-runbook.md.
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
 * Consumer for every dispatched domain event. `step.run` gives durable retry;
 * `runOnce` adds cross-redelivery dedup keyed on the domain event. Real effects
 * (confirmation email / WhatsApp / invoice / shipment) attach in later phases as
 * additional consumers of the same event.
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
  onOutboxDispatched,
];
