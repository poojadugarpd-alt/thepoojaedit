import "server-only";

import { createHash } from "node:crypto";

import {
  canTransition,
  FULFILLMENT_TRANSITIONS,
  type FulfillmentStatus,
} from "@/server/orders/state";

/**
 * Shadowfax raw status → our `FulfillmentStatus`. Shadowfax's vocabulary varies
 * by account/integration; unknown strings normalise to `null` (recorded for
 * audit, no state change) rather than guessed. Confirm the exact set against the
 * live account (see docs/integration-setup.md).
 */
const MAP: Record<string, FulfillmentStatus> = {
  // pre-pickup
  PENDING: "PROCESSING",
  ASSIGNED: "PROCESSING",
  RIDER_ASSIGNED: "PROCESSING",
  PICKUP_SCHEDULED: "PROCESSING",
  OUT_FOR_PICKUP: "PROCESSING",
  // in the network
  PICKED_UP: "SHIPPED",
  PICKUP_DONE: "SHIPPED",
  IN_TRANSIT: "SHIPPED",
  INTRANSIT: "SHIPPED",
  AT_HUB: "SHIPPED",
  REACHED_AT_DESTINATION_HUB: "SHIPPED",
  // last mile
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  OFD: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  // delivery failure (can repeat)
  UNDELIVERED: "NDR",
  NDR: "NDR",
  CUSTOMER_NOT_AVAILABLE: "NDR",
  ADDRESS_ISSUE: "NDR",
  CONSIGNEE_REFUSED: "NDR",
  // return to origin
  RTO: "RTO_IN_TRANSIT",
  RTO_INITIATED: "RTO_IN_TRANSIT",
  RTO_IN_TRANSIT: "RTO_IN_TRANSIT",
  RTO_OUT_FOR_DELIVERY: "RTO_IN_TRANSIT",
  RTO_DELIVERED: "RTO_RECEIVED",
  RTO_RECEIVED: "RTO_RECEIVED",
  // cancelled
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
};

export function normalizeShadowfaxStatus(raw: string): FulfillmentStatus | null {
  return MAP[raw.trim().toUpperCase().replace(/\s+/g, "_")] ?? null;
}

export const SHIPMENT_TERMINAL: ReadonlySet<FulfillmentStatus> = new Set([
  "DELIVERED",
  "RTO_RECEIVED",
  "CANCELLED",
]);

/** A shipment status that has more to happen — safe for the reconcile cron to poll. */
export function isShipmentOpen(statusNormalized: string): boolean {
  return !SHIPMENT_TERMINAL.has(statusNormalized as FulfillmentStatus);
}

/** Rank along the normal delivery path; exceptions (NDR/RTO/CANCELLED) are -1. */
const RANK: Record<FulfillmentStatus, number> = {
  UNFULFILLED: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  NDR: -1,
  RTO_IN_TRANSIT: -1,
  RTO_RECEIVED: -1,
  CANCELLED: -1,
};

/**
 * Should `next` be applied on top of `current`?
 *  - `null` (unknown raw status) → never changes state
 *  - an event older than the newest applied event → never regresses state
 *  - a legal `FULFILLMENT_TRANSITIONS` step (NDR ↔ OUT_FOR_DELIVERY, RTO, …) → apply
 *  - a strictly-forward jump along the happy path (sparse scans can skip a
 *    state, e.g. PROCESSING → DELIVERED) → apply
 *  - anything else (regressions, DELIVERED → SHIPPED, …) → not applied
 */
export function shouldApplyTransition(input: {
  current: FulfillmentStatus;
  next: FulfillmentStatus | null;
  occurredAt: Date | null;
  latestAppliedAt: Date | null;
}): boolean {
  const { current, next, occurredAt, latestAppliedAt } = input;
  if (next === null) return false;
  if (next === current) return false;
  if (
    occurredAt &&
    latestAppliedAt &&
    occurredAt.getTime() < latestAppliedAt.getTime()
  ) {
    return false; // stale / out-of-order callback
  }
  return canAdvanceFulfillment(current, next);
}

/**
 * A legal `FULFILLMENT_TRANSITIONS` step OR a strictly-forward jump along the
 * linear delivery path (sparse scans may skip a state). Used for both the
 * shipment status and the mirrored order fulfilment status.
 */
export function canAdvanceFulfillment(
  from: FulfillmentStatus,
  to: FulfillmentStatus,
): boolean {
  if (from === to) return false;
  if (canTransition(FULFILLMENT_TRANSITIONS, from, to)) return true;
  return RANK[to] > 0 && RANK[from] >= 0 && RANK[to] > RANK[from];
}

/** Deterministic dedupe key for a tracking event with no stable provider id. */
export function eventFingerprint(input: {
  shipmentId: string;
  statusRaw: string;
  occurredAt: Date | null;
  externalEventId?: string | null;
}): string {
  if (input.externalEventId) {
    return `id:${input.externalEventId}`;
  }
  return createHash("sha256")
    .update(
      [
        input.shipmentId,
        input.statusRaw.trim().toUpperCase(),
        input.occurredAt ? input.occurredAt.toISOString() : "",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 40);
}
