import "server-only";

import type { PrismaClient, Shipment } from "@/generated/prisma";
import {
  openOperationalTask,
  resolveOperationalTask,
} from "@/server/events/operational-tasks";
import { restockUnits } from "@/server/inventory/restock";
import {
  canTransition,
  FULFILLMENT_TRANSITIONS,
  type FulfillmentStatus,
} from "@/server/orders/state";
import { serviceabilityTaskKey } from "@/server/orders/lifecycle";
import { appendOrderTimeline } from "@/server/orders/timeline";
import { getShippingRules } from "@/server/settings";
import {
  ingestWebhook,
  markWebhookFailed,
  markWebhookProcessed,
  WebhookVerificationError,
  type ReconcilePort,
} from "@/server/webhooks/inbox";

import { courierTrackingUrl } from "./couriers";
import { ShippingError, type ShippingProvider, type WebhookHint } from "./port";
import {
  canAdvanceFulfillment,
  eventFingerprint,
  normalizeShadowfaxStatus,
  shouldApplyTransition,
} from "./status";

/**
 * Shadowfax fulfilment orchestration (master §8, v1.1). Provider network calls
 * live in the adapter; this module works against the neutral port and the local
 * `Shipment` / `ShipmentEvent` / `CodRemittance` records. Callback bodies are
 * hints only — every state transition is re-derived from the authenticated
 * tracking API.
 */

const SHIPMENT_PROVIDER = "shadowfax";
/** A shipment booked outside the app (another courier) and linked by AWB.
 *  Never polled or cancelled through Shadowfax; status is set by hand. */
export const MANUAL_PROVIDER = "manual";

function merchantRef(orderNumber: string): string {
  return `SHP-${orderNumber}`;
}

// ─────────────────────────── shipment creation ──────────────────────────────

export interface CreateShipmentResult {
  shipment: Shipment;
  created: boolean;
}

/**
 * Create (or adopt) the one shipment for a confirmed order. Safe across retries
 * and unknown outcomes:
 *  - the local `Shipment` row (unique `merchantReference`) is claimed first;
 *  - if the provider might already have it (timeout after creation), we adopt it
 *    via `fetchTracking` instead of creating a duplicate;
 *  - a provider error leaves the claimed row without a `providerShipmentId` and
 *    opens a `shipment-failure` task; the next call retries the same row.
 */
export async function createShipmentForOrder(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { orderId: string; actor?: string },
): Promise<CreateShipmentResult> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { items: true, addresses: true },
  });
  if (order.orderStatus !== "CONFIRMED") {
    throw new ShippingError(
      `Order ${order.orderNumber} is ${order.orderStatus}; a shipment needs a CONFIRMED order.`,
    );
  }
  if (order.fulfillmentStatus === "CANCELLED") {
    throw new ShippingError("Order fulfilment is cancelled.");
  }

  const ref = merchantRef(order.orderNumber);
  const rules = await getShippingRules(db);

  const drop = order.addresses.find((a) => a.type === "SHIPPING");
  if (!drop) throw new ShippingError("Order has no shipping address.");

  const variantIds = order.items
    .map((i) => i.variantId)
    .filter((v): v is string => Boolean(v));
  const variants = variantIds.length
    ? await db.productVariant.findMany({ where: { id: { in: variantIds } } })
    : [];
  const weightById = new Map(variants.map((v) => [v.id, v.weightGrams]));
  const weightGrams = order.items.reduce(
    (sum, i) =>
      sum +
      i.quantity *
        (i.variantId
          ? (weightById.get(i.variantId) ?? rules.defaultWeightGrams)
          : rules.defaultWeightGrams),
    0,
  );

  // Claim / find the local row.
  let shipment = await db.shipment.findUnique({ where: { merchantReference: ref } });
  if (shipment?.providerShipmentId) {
    return { shipment, created: false };
  }
  if (!shipment) {
    shipment = await db.shipment.create({
      data: {
        orderId: order.id,
        provider: SHIPMENT_PROVIDER,
        merchantReference: ref,
        statusNormalized: "PENDING",
        weightGrams,
        items: {
          create: order.items.map((i) => ({
            orderItemId: i.id,
            quantity: i.quantity,
          })),
        },
      },
    });
  }

  // Maybe the provider already has it (timeout AFTER creation on a prior try).
  try {
    const existing = await provider.fetchTracking({ merchantReference: ref });
    if (existing.awb || existing.statusRaw !== "UNKNOWN") {
      return finishCreate(
        db,
        provider,
        order.id,
        shipment.id,
        {
          providerShipmentId: existing.awb ?? ref,
          awb: existing.awb,
          courier: "Shadowfax",
          trackingUrl: null,
          labelUrl: null,
          statusRaw: existing.statusRaw,
          raw: existing.raw,
        },
        order.paymentMethod,
        order.totalPaise,
        input.actor,
      );
    }
  } catch {
    // not found on the provider — proceed to create
  }

  try {
    const created = await provider.createShipment({
      merchantReference: ref,
      pickup: { ...rules.pickup },
      drop: {
        name: drop.name,
        phone: drop.phone,
        line1: drop.line1,
        line2: drop.line2,
        landmark: drop.landmark,
        city: drop.city,
        stateName: drop.stateName,
        stateCode: drop.stateCode,
        postcode: drop.postcode,
        country: drop.country,
      },
      paymentMethod: order.paymentMethod,
      codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
      items: order.items.map((i) => ({
        descriptor: i.title,
        sku: i.sku,
        quantity: i.quantity,
        unitValuePaise: i.unitPricePaise,
      })),
      weightGrams,
      invoiceValuePaise: order.totalPaise,
    });
    return finishCreate(
      db,
      provider,
      order.id,
      shipment.id,
      created,
      order.paymentMethod,
      order.totalPaise,
      input.actor,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await openOperationalTask(db, {
      dedupeKey: `shipment-failure:${order.id}`,
      type: "SHIPMENT_FAILURE",
      entityType: "Order",
      entityId: order.id,
      priority: 1,
      reason: /servic/i.test(message)
        ? `${message} — Shadowfax doesn't deliver to PIN ${drop.postcode}. Book it on Delhivery and enter the AWB in Admin → Other courier.`
        : message,
    });
    throw e instanceof ShippingError
      ? e
      : new ShippingError(
          `Shadowfax shipment creation failed: ${e instanceof Error ? e.message : String(e)}`,
        );
  }
}

async function finishCreate(
  db: PrismaClient,
  provider: ShippingProvider | null,
  orderId: string,
  shipmentId: string,
  created: {
    providerShipmentId: string;
    awb: string | null;
    courier: string | null;
    trackingUrl: string | null;
    labelUrl: string | null;
    statusRaw: string;
    raw: unknown;
  },
  paymentMethod: "PREPAID_RAZORPAY" | "COD",
  totalPaise: number,
  actor?: string,
): Promise<CreateShipmentResult> {
  const normalized = normalizeShadowfaxStatus(created.statusRaw) ?? "PROCESSING";
  const shipment = await db.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        providerShipmentId: created.providerShipmentId,
        awb: created.awb,
        courier: created.courier,
        trackingUrl: created.trackingUrl,
        statusRaw: created.statusRaw,
        statusNormalized: normalized,
      },
    });

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (
      order.fulfillmentStatus === "UNFULFILLED" &&
      canTransition(FULFILLMENT_TRANSITIONS, "UNFULFILLED", "PROCESSING")
    ) {
      await tx.order.update({
        where: { id: orderId, version: order.version },
        data: { fulfillmentStatus: "PROCESSING", version: { increment: 1 } },
      });
    }

    if (paymentMethod === "COD") {
      const existing = await tx.codRemittance.findFirst({
        where: { orderId, shipmentId: s.id },
      });
      if (!existing) {
        await tx.codRemittance.create({
          data: {
            orderId,
            shipmentId: s.id,
            expectedPaise: totalPaise,
            status: "PENDING",
          },
        });
      }
    }

    await appendOrderTimeline(tx, {
      orderId,
      type: "shipment.created",
      payload: {
        shipmentId: s.id,
        awb: created.awb,
        providerShipmentId: created.providerShipmentId,
      },
      actor,
    });
    return s;
  });

  await resolveOperationalTask(db, `shipment-failure:${orderId}`);
  await resolveOperationalTask(db, serviceabilityTaskKey(orderId));
  // Fold in whatever scans the provider already has.
  if (provider) {
    await reconcileShipment(db, provider, { shipmentId: shipment.id }).catch(() => {});
  }
  return {
    shipment: await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } }),
    created: true,
  };
}

// ─────────────────────────── tracking application ───────────────────────────

export interface ApplyEventResult {
  recorded: boolean;
  duplicate: boolean;
  statusChanged: boolean;
  normalized: FulfillmentStatus | null;
}

/**
 * Record one tracking event and, if it is newer than the last applied event and
 * a legal transition, advance the shipment (and mirror to the order). Older or
 * illegal events are still stored for audit but never regress state. NDR/RTO
 * side effects are raised here; RTO-in-transit never restocks.
 */
export async function applyTrackingEvent(
  db: PrismaClient,
  input: {
    shipmentId: string;
    statusRaw: string;
    occurredAt: Date | null;
    externalEventId?: string | null;
    note?: string | null;
    source?: string;
  },
): Promise<ApplyEventResult> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
  });
  const normalized = normalizeShadowfaxStatus(input.statusRaw);
  const fp = eventFingerprint({
    shipmentId: shipment.id,
    statusRaw: input.statusRaw,
    occurredAt: input.occurredAt,
    externalEventId: input.externalEventId,
  });

  try {
    await db.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        externalEventId: input.externalEventId ?? null,
        eventFingerprint: fp,
        statusRaw: input.statusRaw,
        statusNormalized: normalized,
        occurredAt: input.occurredAt,
        metadata: input.note
          ? { note: input.note, source: input.source ?? null }
          : undefined,
      },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return { recorded: false, duplicate: true, statusChanged: false, normalized };
    }
    throw e;
  }

  // newest other timestamped normalized event — an older callback must not
  // regress state (events with no timestamp are ignored for ordering)
  const latestApplied = await db.shipmentEvent.findFirst({
    where: {
      shipmentId: shipment.id,
      statusNormalized: { not: null },
      occurredAt: { not: null },
      NOT: { eventFingerprint: fp },
    },
    orderBy: { occurredAt: "desc" },
  });

  const apply = shouldApplyTransition({
    current: shipment.statusNormalized as FulfillmentStatus,
    next: normalized,
    occurredAt: input.occurredAt,
    latestAppliedAt: latestApplied?.occurredAt ?? null,
  });

  if (!apply) {
    return { recorded: true, duplicate: false, statusChanged: false, normalized };
  }

  await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipment.id },
      data: { statusNormalized: normalized!, statusRaw: input.statusRaw },
    });
    const order = await tx.order.findUniqueOrThrow({ where: { id: shipment.orderId } });
    if (
      order.fulfillmentStatus !== normalized &&
      canAdvanceFulfillment(order.fulfillmentStatus as FulfillmentStatus, normalized!)
    ) {
      await tx.order.update({
        where: { id: order.id, version: order.version },
        data: { fulfillmentStatus: normalized!, version: { increment: 1 } },
      });
    }
    await appendOrderTimeline(tx, {
      orderId: shipment.orderId,
      type: `shipment.${normalized!.toLowerCase()}`,
      payload: {
        shipmentId: shipment.id,
        statusRaw: input.statusRaw,
        occurredAt: input.occurredAt?.toISOString() ?? null,
      },
    });
  });

  await runStatusSideEffects(db, shipment.id, shipment.orderId, normalized!);

  return { recorded: true, duplicate: false, statusChanged: true, normalized };
}

async function runStatusSideEffects(
  db: PrismaClient,
  shipmentId: string,
  orderId: string,
  normalized: FulfillmentStatus,
): Promise<void> {
  if (normalized === "NDR") {
    const count = await db.shipmentEvent.count({
      where: { shipmentId, statusNormalized: "NDR" },
    });
    await openOperationalTask(db, {
      dedupeKey: `ndr:${shipmentId}`,
      type: "NDR",
      entityType: "Shipment",
      entityId: shipmentId,
      priority: 1,
      reason: `Delivery failed (attempt ${count}). Contact the customer / re-attempt.`,
    });
  } else if (normalized === "RTO_IN_TRANSIT") {
    // Returning to origin — NO restock here (master §7).
    await openOperationalTask(db, {
      dedupeKey: `rto:${shipmentId}`,
      type: "RTO_INSPECTION",
      entityType: "Shipment",
      entityId: shipmentId,
      priority: 2,
      reason:
        "Parcel is being returned to origin. Inspect on receipt before any restock.",
    });
  } else if (normalized === "RTO_RECEIVED") {
    await openOperationalTask(db, {
      dedupeKey: `rto-inspection:${shipmentId}`,
      type: "RTO_INSPECTION",
      entityType: "Shipment",
      entityId: shipmentId,
      priority: 1,
      reason:
        "RTO parcel received. Inspect and decide restock / quarantine / write-off.",
    });
  } else if (normalized === "OUT_FOR_DELIVERY" || normalized === "SHIPPED") {
    await resolveOperationalTask(db, `ndr:${shipmentId}`);
  }
}

// ───────────────────────────── reconciliation ──────────────────────────────

export async function reconcileShipment(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { shipmentId: string },
): Promise<{ applied: number; recorded: number }> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
  });
  if (shipment.provider === MANUAL_PROVIDER) {
    throw new ShippingError(
      `${shipment.courier ?? "This courier"} isn't tracked automatically — set the status by hand.`,
    );
  }
  const snapshot = await provider.fetchTracking({
    awb: shipment.awb,
    merchantReference: shipment.merchantReference,
  });

  // Only real courier scans drive state. A snapshot with a `current_status` but
  // no scan history carries no reliable timestamp, so it is not synthesised into
  // an event (that would poison the ordering guard).
  const ordered = [...snapshot.events].sort(
    (a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0),
  );

  let applied = 0;
  let recorded = 0;
  for (const ev of ordered) {
    const r = await applyTrackingEvent(db, {
      shipmentId: shipment.id,
      statusRaw: ev.statusRaw,
      occurredAt: ev.occurredAt,
      externalEventId: ev.externalEventId,
      note: ev.note,
      source: "reconcile",
    });
    if (r.recorded) recorded += 1;
    if (r.statusChanged) applied += 1;
  }
  return { applied, recorded };
}

/** `ReconcilePort` for the shipment-reconciliation cron. */
export function makeShipmentReconcilePort(
  db: PrismaClient,
  provider: ShippingProvider,
  opts: { limit?: number } = {},
): ReconcilePort {
  const limit = opts.limit ?? 50;
  return {
    name: "shadowfax-shipments",
    async reconcilePending() {
      const open = await db.shipment.findMany({
        where: {
          provider: SHIPMENT_PROVIDER,
          providerShipmentId: { not: null },
          statusNormalized: { notIn: ["DELIVERED", "RTO_RECEIVED", "CANCELLED"] },
        },
        take: limit,
        orderBy: { updatedAt: "asc" },
      });
      let updated = 0;
      let unresolved = 0;
      for (const s of open) {
        try {
          const r = await reconcileShipment(db, provider, { shipmentId: s.id });
          if (r.applied > 0) updated += 1;
        } catch {
          unresolved += 1;
        }
      }
      return { checked: open.length, updated, unresolved };
    },
  };
}

// ─────────────────────────────── webhook inbox ──────────────────────────────

export interface WebhookResult {
  httpStatus: number;
  body: unknown;
}

/**
 * Shadowfax callback: verify what little we can (a configured static token),
 * persist + dedupe, then IGNORE the body's claimed status and re-read the
 * authenticated tracking API before changing anything (master §8 — weak callback
 * auth → verify critical state against the API).
 */
export async function handleShadowfaxWebhook(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { rawBody: Buffer; headers: Headers },
): Promise<WebhookResult> {
  let ingest;
  try {
    ingest = await ingestWebhook(db, {
      provider: SHIPMENT_PROVIDER,
      rawBody: input.rawBody,
      headers: input.headers,
      verify: (b, h) => {
        const hint = provider.parseWebhook(b, h);
        return {
          externalEventId: hint.fingerprint,
          eventType: `tracking.${hint.statusRaw}`,
          parsed: hint,
        };
      },
    });
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return { httpStatus: 401, body: { error: "invalid callback token" } };
    }
    return { httpStatus: 500, body: { error: "persistence failure" } };
  }

  if (!ingest.isNew) {
    return { httpStatus: 200, body: { deduplicated: true } };
  }

  const parsed = ingest.event.payload as unknown as WebhookHint;
  try {
    const shipment = await db.shipment.findFirst({
      where: {
        provider: SHIPMENT_PROVIDER,
        OR: [
          parsed.merchantReference
            ? { merchantReference: parsed.merchantReference }
            : { id: "00000000-0000-0000-0000-000000000000" },
          parsed.awb
            ? { awb: parsed.awb }
            : { id: "00000000-0000-0000-0000-000000000000" },
        ],
      },
    });
    if (!shipment) {
      await openOperationalTask(db, {
        dedupeKey: `shipment-review:${parsed.merchantReference ?? parsed.awb ?? "unknown"}`,
        type: "SHIPMENT_FAILURE",
        reason: `callback for an unknown shipment (${parsed.merchantReference ?? parsed.awb ?? "?"})`,
      });
      await markWebhookProcessed(db, ingest.event.id);
      return { httpStatus: 200, body: { ok: true, unknownShipment: true } };
    }
    // Re-verify against the API — do not trust the callback body's status.
    await reconcileShipment(db, provider, { shipmentId: shipment.id });
    await markWebhookProcessed(db, ingest.event.id);
    return { httpStatus: 200, body: { ok: true } };
  } catch (e) {
    await markWebhookFailed(
      db,
      ingest.event.id,
      e instanceof Error ? e.message : String(e),
    );
    return { httpStatus: 500, body: { error: "processing failed" } };
  }
}

// ──────────────────────────── RTO inspection ────────────────────────────────

export type RtoOutcome = "RESTOCK" | "QUARANTINE" | "WRITE_OFF";

/**
 * Authorised RTO inspection (master §8 — "Admin overrides require reason,
 * authorization, timeline entry, and audit"). On RESTOCK, on-hand is increased
 * exactly once (ledger key `rto-restock:<shipmentId>:<variantId>`); a repeat
 * inspection restocks nothing.
 */
export async function inspectRtoReturn(
  db: PrismaClient,
  input: {
    shipmentId: string;
    adminUserId: string;
    outcome: RtoOutcome;
    reason: string;
  },
): Promise<{ restockedVariants: number }> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
    include: { items: { include: { orderItem: true } } },
  });
  if (shipment.statusNormalized !== "RTO_RECEIVED") {
    throw new ShippingError(
      `Shipment is ${shipment.statusNormalized}; RTO inspection needs RTO_RECEIVED.`,
    );
  }

  const result = await db.$transaction(async (tx) => {
    let restockedVariants = 0;
    if (input.outcome === "RESTOCK") {
      const lines = shipment.items
        .filter((si) => si.orderItem.variantId)
        .map((si) => ({
          variantId: si.orderItem.variantId!,
          quantity: si.quantity,
          orderId: shipment.orderId,
        }));
      const r = await restockUnits(tx, {
        keyScope: `rto-restock:${shipment.id}`,
        txnType: "RTO_RESTOCK",
        lines,
        reason: `RTO inspected: ${input.reason}`,
      });
      restockedVariants = r.restockedVariants;
    }

    await tx.adminActivityLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "shipment.rto_inspected",
        entityType: "Shipment",
        entityId: shipment.id,
        reason: input.reason,
        after: { outcome: input.outcome, restockedVariants },
      },
    });
    await appendOrderTimeline(tx, {
      orderId: shipment.orderId,
      type: "shipment.rto_inspected",
      payload: { shipmentId: shipment.id, outcome: input.outcome, restockedVariants },
      actor: input.adminUserId,
    });
    return { restockedVariants };
  });

  await resolveOperationalTask(db, `rto-inspection:${shipment.id}`);
  await resolveOperationalTask(db, `rto:${shipment.id}`);
  return result;
}

// ────────────────────────── COD collection / remittance ─────────────────────

/**
 * Pull the COD money position from Shadowfax and reflect it locally. Collection
 * (courier has the cash) and remittance (money reached the merchant bank) are
 * tracked as separate fields / statuses / timestamps. Delivery alone never marks
 * a COD order paid; a confirmed *collection* sets `COD_COLLECTED`.
 */
export async function syncCodRemittance(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { shipmentId: string },
): Promise<{ status: string } | null> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
  });
  const record = await provider.fetchCodRemittance({
    merchantReference: shipment.merchantReference,
    awb: shipment.awb,
  });
  if (!record) return null;

  const remittance = await db.codRemittance.findFirst({
    where: { shipmentId: shipment.id },
  });
  if (!remittance) return null;

  const collected = record.collectedPaise;
  const remitted = record.remittedPaise;

  let status = remittance.status;
  if (remitted != null && remitted > 0) status = "REMITTED";
  else if (collected != null && collected > 0) status = "COLLECTED";

  const discrepancy = collected != null && collected !== remittance.expectedPaise;
  if (discrepancy) status = "DISPUTED";

  await db.codRemittance.update({
    where: { id: remittance.id },
    data: {
      collectedPaise: collected ?? remittance.collectedPaise,
      remittedPaise: remitted ?? remittance.remittedPaise,
      providerReference: record.providerReference ?? remittance.providerReference,
      collectedAt: record.collectedAt ?? remittance.collectedAt,
      remittedAt: record.remittedAt ?? remittance.remittedAt,
      status,
    },
  });

  // Confirmed collection → order payment status COD_COLLECTED (not from delivery alone).
  if (collected != null && collected > 0 && !discrepancy) {
    const order = await db.order.findUniqueOrThrow({ where: { id: shipment.orderId } });
    if (order.paymentMethod === "COD" && order.paymentStatus === "COD_PENDING") {
      await db.order.update({
        where: { id: order.id, version: order.version },
        data: { paymentStatus: "COD_COLLECTED", version: { increment: 1 } },
      });
      await db.$transaction((tx) =>
        appendOrderTimeline(tx, {
          orderId: order.id,
          type: "cod.collected",
          payload: { shipmentId: shipment.id, collectedPaise: collected },
        }),
      );
    }
  }

  if (discrepancy) {
    await openOperationalTask(db, {
      dedupeKey: `cod-remittance:${shipment.orderId}`,
      type: "PAYMENT_REVIEW",
      entityType: "Order",
      entityId: shipment.orderId,
      priority: 1,
      reason: `COD collected ${collected} paise ≠ expected ${remittance.expectedPaise} paise`,
    });
  }

  return { status };
}

// ─────────────────────────────── label access ──────────────────────────────

export async function getShipmentLabel(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { shipmentId: string },
): Promise<{ contentType: string; bytes: Buffer }> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
  });
  if (!shipment.awb) throw new ShippingError("Shipment has no AWB yet.");
  if (shipment.provider === MANUAL_PROVIDER) {
    throw new ShippingError(
      `Print the label from ${shipment.courier ?? "the courier"}.`,
    );
  }
  const label = await provider.fetchLabel({ awb: shipment.awb });
  return { contentType: label.contentType, bytes: label.bytes };
}

// ─────────────────── outbox-driven auto shipment creation ───────────────────

/**
 * React to a confirmed order (payment settled or COD confirmed) by creating its
 * shipment. Idempotent via the unique `merchantReference`; used by the Inngest
 * consumer of `poojaedit/outbox.dispatched`.
 */
/**
 * Cancel an order's not-yet-picked-up shipment(s) with the provider, so the
 * order itself can then be cancelled (D-133). Without this, an order became
 * uncancellable the moment `create-shipment-on-confirm` booked its pickup.
 *
 * Provider calls happen OUTSIDE any transaction; a local row is only marked
 * CANCELLED once the provider accepted the cancellation. A claimed row that
 * never got a provider id (failed create) is cancelled locally only.
 * Already-cancelled rows are skipped, so a retry is safe.
 */
export async function cancelShipmentsForOrder(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { orderId: string; actor?: string },
): Promise<{ cancelled: number }> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { shipments: true },
  });
  if (
    order.fulfillmentStatus !== "UNFULFILLED" &&
    order.fulfillmentStatus !== "PROCESSING"
  ) {
    throw new ShippingError(
      `Order ${order.orderNumber} is ${order.fulfillmentStatus}; only a shipment that hasn't been picked up can be cancelled.`,
    );
  }

  let cancelled = 0;
  for (const s of order.shipments) {
    if (s.statusNormalized === "CANCELLED") continue;
    // A manually linked shipment is cancelled with its courier by the owner;
    // here it is only marked cancelled.
    if (s.providerShipmentId && s.provider !== MANUAL_PROVIDER) {
      const r = await provider.cancelShipment({
        awb: s.awb,
        merchantReference: s.merchantReference,
      });
      if (!r.cancelled) {
        throw new ShippingError(
          `Shadowfax did not accept the cancellation for ${s.awb ?? s.merchantReference}.`,
        );
      }
    }
    await db.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: s.id },
        data: { statusNormalized: "CANCELLED" },
      });
      await appendOrderTimeline(tx, {
        orderId: order.id,
        type: "shipment.cancelled",
        payload: { shipmentId: s.id, awb: s.awb },
        actor: input.actor,
      });
    });
    cancelled++;
  }
  return { cancelled };
}

// ─────────────────────── shipments booked outside the app ───────────────────

const AWB_RE = /^[A-Za-z0-9-]{4,40}$/;

/**
 * Attach a shipment that was booked outside the app — on the Shadowfax360
 * dashboard, or with another courier when Shadowfax doesn't serve the PIN.
 * Shadowfax AWBs are checked against the tracking API and then tracked like any
 * other; other couriers become a `manual` shipment whose status is set by hand.
 * Either way the order moves to PROCESSING, the failure task clears and the
 * customer gets the AWB email (via `shipment.created`).
 */
export async function linkExistingShipment(
  db: PrismaClient,
  provider: ShippingProvider | null,
  input: {
    orderId: string;
    courier: string;
    awb: string;
    trackingUrl?: string | null;
    actor?: string;
  },
): Promise<Shipment> {
  const awb = input.awb.trim();
  const courierIn = input.courier.trim();
  const trackingUrl = input.trackingUrl?.trim() || null;
  if (!AWB_RE.test(awb)) {
    throw new ShippingError("AWB must be 4–40 letters, numbers or dashes.");
  }
  if (!courierIn || courierIn.length > 40) {
    throw new ShippingError("Enter the courier's name.");
  }
  if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) {
    throw new ShippingError("Tracking link must start with https://");
  }
  const isShadowfax = courierIn.toLowerCase() === "shadowfax";
  const courier = isShadowfax ? "Shadowfax" : courierIn;
  // A known courier's public tracking page goes in the customer's AWB email.
  const trackingLink =
    trackingUrl ?? (isShadowfax ? null : courierTrackingUrl(courier, awb));

  const order = await db.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (order.orderStatus !== "CONFIRMED") {
    throw new ShippingError(
      `Order ${order.orderNumber} is ${order.orderStatus}; only a confirmed order can ship.`,
    );
  }
  if (order.fulfillmentStatus === "CANCELLED") {
    throw new ShippingError("Order fulfilment is cancelled.");
  }

  const ref = merchantRef(order.orderNumber);
  let shipment = await db.shipment.findUnique({ where: { merchantReference: ref } });
  if (shipment?.providerShipmentId && shipment.statusNormalized !== "CANCELLED") {
    throw new ShippingError(
      `This order already has a shipment (AWB ${shipment.awb ?? shipment.providerShipmentId}).`,
    );
  }

  let statusRaw = "linked";
  if (isShadowfax) {
    if (!provider) throw new ShippingError("Shadowfax is not configured here.");
    // Proves the AWB exists on this Shadowfax account before we trust it.
    const snapshot = await provider.fetchTracking({ awb });
    statusRaw = snapshot.statusRaw;
  }

  const providerName = isShadowfax ? SHIPMENT_PROVIDER : MANUAL_PROVIDER;
  if (!shipment) {
    shipment = await db.shipment.create({
      data: {
        orderId: order.id,
        provider: providerName,
        merchantReference: ref,
        statusNormalized: "PENDING",
        items: {
          create: order.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity })),
        },
      },
    });
  } else {
    shipment = await db.shipment.update({
      where: { id: shipment.id },
      data: { provider: providerName, statusNormalized: "PENDING" },
    });
  }

  const r = await finishCreate(
    db,
    isShadowfax ? provider : null,
    order.id,
    shipment.id,
    {
      providerShipmentId: awb,
      awb,
      courier,
      trackingUrl: trackingLink,
      labelUrl: null,
      statusRaw,
      raw: { linkedBy: input.actor ?? null },
    },
    order.paymentMethod,
    order.totalPaise,
    input.actor,
  );
  return r.shipment;
}

/** Hand-set status for a manually linked shipment (no courier API to poll). */
export async function setManualShipmentStatus(
  db: PrismaClient,
  input: { shipmentId: string; status: "SHIPPED" | "DELIVERED"; actor?: string },
): Promise<ApplyEventResult> {
  const shipment = await db.shipment.findUniqueOrThrow({
    where: { id: input.shipmentId },
  });
  if (shipment.provider !== MANUAL_PROVIDER) {
    throw new ShippingError("Only a manually linked shipment's status is set by hand.");
  }
  return applyTrackingEvent(db, {
    shipmentId: shipment.id,
    // Raw values the status map already understands.
    statusRaw: input.status === "SHIPPED" ? "IN_TRANSIT" : "DELIVERED",
    occurredAt: new Date(),
    externalEventId: `manual:${input.status}`,
    note: input.actor ? `set by ${input.actor}` : "set by admin",
    source: "admin",
  });
}

export async function ensureShipmentForConfirmedOrder(
  db: PrismaClient,
  provider: ShippingProvider,
  input: { orderId: string },
): Promise<{ created: boolean; skipped?: string }> {
  const order = await db.order.findUnique({ where: { id: input.orderId } });
  if (!order) return { created: false, skipped: "order not found" };
  if (order.orderStatus !== "CONFIRMED") {
    return { created: false, skipped: `order is ${order.orderStatus}` };
  }
  const existing = await db.shipment.findUnique({
    where: { merchantReference: merchantRef(order.orderNumber) },
  });
  if (existing?.providerShipmentId) return { created: false, skipped: "exists" };

  const r = await createShipmentForOrder(db, provider, { orderId: order.id });
  return { created: r.created };
}

export { merchantRef };

// ──────────────────── "Other courier" admin tab (D-153) ─────────────────────

/**
 * Work for the admin "Other courier" tab: confirmed orders Shadowfax couldn't
 * book (an open `shipment-failure` or `serviceability-unconfirmed` task) that
 * have no booked shipment yet, and parcels already sent with another courier
 * that aren't delivered.
 */
export async function listOtherCourierWork(db: PrismaClient) {
  const tasks = await db.operationalTask.findMany({
    where: {
      status: "OPEN",
      entityType: "Order",
      OR: [
        { dedupeKey: { startsWith: "shipment-failure:" } },
        { dedupeKey: { startsWith: "serviceability-unconfirmed:" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const reasonByOrder = new Map<string, string>();
  for (const t of tasks) {
    if (t.entityId && !reasonByOrder.has(t.entityId)) {
      reasonByOrder.set(t.entityId, t.reason ?? "");
    }
  }

  const select = {
    id: true,
    orderNumber: true,
    placedAt: true,
    totalPaise: true,
    paymentMethod: true,
    addresses: { where: { type: "SHIPPING" as const } },
    shipments: { orderBy: { createdAt: "desc" as const }, take: 1 },
  };
  const [waiting, sent] = await Promise.all([
    db.order.findMany({
      where: {
        id: { in: [...reasonByOrder.keys()] },
        orderStatus: "CONFIRMED",
        fulfillmentStatus: "UNFULFILLED",
        isTest: false,
      },
      select,
      orderBy: { placedAt: "asc" },
    }),
    db.order.findMany({
      where: {
        isTest: false,
        shipments: {
          some: {
            provider: MANUAL_PROVIDER,
            statusNormalized: { notIn: ["DELIVERED", "CANCELLED", "RTO_RECEIVED"] },
          },
        },
      },
      select,
      orderBy: { placedAt: "asc" },
    }),
  ]);
  return {
    waiting: waiting.map((o) => ({ ...o, reason: reasonByOrder.get(o.id) ?? "" })),
    sent,
  };
}
