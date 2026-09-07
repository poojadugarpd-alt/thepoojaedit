import "server-only";

import { createHash } from "node:crypto";

import type { Order, PrismaClient } from "@/generated/prisma";
import { allocateCodStock } from "@/server/inventory/cod";
import { reserveAll } from "@/server/inventory/reservations";
import { issueOrderAccessToken } from "@/server/orders/access-tokens";
import { generateOrderNumber } from "@/server/orders/order-number";
import { appendOrderTimeline } from "@/server/orders/timeline";
import type { ShippingPort } from "@/server/shipping";

import { computeQuote, QuoteError, type QuoteInput } from "./quote";

export class CheckoutError extends Error {}
export class IdempotencyConflictError extends CheckoutError {
  constructor() {
    super("This checkout key was already used with different items.");
    this.name = "IdempotencyConflictError";
  }
}
export class PriceChangedError extends CheckoutError {
  constructor() {
    super("Prices or availability changed. Please review your order again.");
    this.name = "PriceChangedError";
  }
}

export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  stateName: string;
  stateCode: string;
  postcode: string;
  country?: string;
}

export interface PlaceOrderInput {
  idempotencyKey: string;
  scope: string; // "customer:<id>" | "guest:<hash>"
  customerId?: string | null;
  contact: { email?: string | null; phone: string };
  lines: { variantId: string; quantity: number }[];
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  billing: AddressInput;
  shipping: AddressInput;
  source?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  /** Hash of the quote the customer reviewed; a mismatch → PriceChangedError. */
  clientQuoteHash?: string | null;
  shippingPort?: ShippingPort;
  now?: Date;
  guestTokenTtlSeconds?: number;
}

export interface PlaceOrderResult {
  order: Order;
  alreadyExisted: boolean;
  guestAccessToken?: string;
}

function addressData(type: "BILLING" | "SHIPPING", a: AddressInput) {
  return {
    type,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? null,
    landmark: a.landmark ?? null,
    city: a.city,
    stateName: a.stateName,
    stateCode: a.stateCode,
    postcode: a.postcode,
    country: a.country ?? "IN",
  };
}

const isP2002 = (e: unknown) => (e as { code?: string })?.code === "P2002";

/**
 * Authoritative checkout (master §7). Recomputes the quote server-side (client
 * prices/totals are never trusted), deduplicates by (scope, idempotencyKey) +
 * request hash, then in ONE short transaction creates the order snapshots and
 * reserves (prepaid) or allocates (COD) all stock. Provider calls happen AFTER
 * this commits (Phase 7).
 */
export async function placeOrder(
  db: PrismaClient,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!input.contact.phone || input.contact.phone.trim().length < 6) {
    throw new CheckoutError("A phone number is required.");
  }

  const quoteInput: QuoteInput = {
    lines: input.lines,
    paymentMethod: input.paymentMethod,
    destination: {
      stateCode: input.shipping.stateCode,
      postcode: input.shipping.postcode,
    },
    shipping: input.shippingPort,
    now: input.now,
  };
  const quote = await computeQuote(db, quoteInput);

  if (input.clientQuoteHash && input.clientQuoteHash !== quote.hash) {
    throw new PriceChangedError();
  }

  // Fast path: an already-completed identical checkout returns its order.
  const existing = await db.checkoutRequest.findUnique({
    where: {
      scope_idempotencyKey: {
        scope: input.scope,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== quote.hash) throw new IdempotencyConflictError();
    if (existing.status === "COMPLETED" && existing.orderId) {
      const order = await db.order.findUniqueOrThrow({
        where: { id: existing.orderId },
      });
      return { order, alreadyExisted: true };
    }
  }

  const now = input.now ?? new Date();
  const taxBreakdown = {
    mode: quote.lines[0]?.pricingMode ?? "INCLUSIVE",
    interState: quote.interState,
    supplierStateCode: quote.supplierStateCode,
    placeOfSupplyStateCode: quote.placeOfSupplyStateCode,
    components: {
      cgst: quote.lines.reduce((s, l) => s + l.cgstPaise, 0),
      sgst: quote.lines.reduce((s, l) => s + l.sgstPaise, 0),
      igst: quote.lines.reduce((s, l) => s + l.igstPaise, 0),
    },
  };

  const run = async (): Promise<PlaceOrderResult> => {
    return db.$transaction(async (tx) => {
      // Claim the idempotency key (or discover a concurrent winner).
      let checkoutRequestId: string;
      try {
        const cr = await tx.checkoutRequest.create({
          data: {
            scope: input.scope,
            idempotencyKey: input.idempotencyKey,
            requestHash: quote.hash,
            status: "PENDING",
            expiresAt: quote.expiresAt,
          },
          select: { id: true },
        });
        checkoutRequestId = cr.id;
      } catch (e) {
        if (!isP2002(e)) throw e;
        const other = await tx.checkoutRequest.findUniqueOrThrow({
          where: {
            scope_idempotencyKey: {
              scope: input.scope,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (other.requestHash !== quote.hash) throw new IdempotencyConflictError();
        if (other.status === "COMPLETED" && other.orderId) {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: other.orderId },
          });
          return { order, alreadyExisted: true };
        }
        checkoutRequestId = other.id;
      }

      const orderStatus =
        input.paymentMethod === "COD" ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT";
      const paymentStatus = input.paymentMethod === "COD" ? "COD_PENDING" : "UNPAID";

      let order: Order | null = null;
      for (let attempt = 0; attempt < 4 && !order; attempt++) {
        try {
          order = await tx.order.create({
            data: {
              orderNumber: generateOrderNumber(now),
              customerId: input.customerId ?? null,
              contactEmail: input.contact.email ?? null,
              contactPhone: input.contact.phone,
              orderStatus,
              paymentStatus,
              fulfillmentStatus: "UNFULFILLED",
              paymentMethod: input.paymentMethod,
              currency: "INR",
              source: input.source ?? null,
              utmSource: input.utm?.source ?? null,
              utmMedium: input.utm?.medium ?? null,
              utmCampaign: input.utm?.campaign ?? null,
              subtotalPaise: quote.subtotalPaise,
              discountPaise: quote.discountPaise,
              shippingPaise: quote.shippingPaise,
              codFeePaise: quote.codFeePaise,
              taxPaise: quote.taxPaise,
              totalPaise: quote.totalPaise,
              taxBreakdown,
              placedAt: now,
              items: {
                create: quote.lines.map((l) => ({
                  productId: l.productId,
                  variantId: l.variantId,
                  catalog: l.catalog,
                  sku: l.sku,
                  title: l.title,
                  imageBucket: l.imageBucket,
                  imagePath: l.imagePath,
                  size: l.size,
                  color: l.color,
                  quantity: l.quantity,
                  unitPricePaise: l.unitPricePaise,
                  discountPaise: 0,
                  hsnCode: l.hsnCode,
                  taxTreatment: l.taxTreatment,
                  taxRateBps: l.taxRateBps,
                  taxableValuePaise: l.taxableValuePaise,
                  cgstPaise: l.cgstPaise,
                  sgstPaise: l.sgstPaise,
                  igstPaise: l.igstPaise,
                  totalPaise: l.lineTotalPaise,
                  returnPolicySnapshot: l.returnPolicySnapshot as object,
                })),
              },
              addresses: {
                create: [
                  addressData("BILLING", input.billing),
                  addressData("SHIPPING", input.shipping),
                ],
              },
            },
          });
        } catch (e) {
          if (!isP2002(e)) throw e; // order-number collision → retry
        }
      }
      if (!order) throw new CheckoutError("Could not allocate an order number.");

      const reserveLines = quote.lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      }));
      if (input.paymentMethod === "COD") {
        await allocateCodStock(tx, { orderId: order.id, lines: reserveLines });
      } else {
        await reserveAll(tx, {
          orderId: order.id,
          lines: reserveLines,
          ttlSeconds: quote.reservationTtlSeconds,
          now,
        });
      }

      await tx.checkoutRequest.update({
        where: { id: checkoutRequestId },
        data: { status: "COMPLETED", orderId: order.id, resultRef: order.orderNumber },
      });

      // Timeline + transactional outbox — same tx as the order (master §8).
      await appendOrderTimeline(tx, {
        orderId: order.id,
        type: "order.placed",
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentMethod: input.paymentMethod,
          totalPaise: order.totalPaise,
        },
      });

      let guestAccessToken: string | undefined;
      if (!input.customerId) {
        const issued = await issueOrderAccessToken(tx, {
          orderId: order.id,
          scope: "ORDER_VIEW",
          ttlSeconds: input.guestTokenTtlSeconds ?? 60 * 60 * 24 * 30,
        });
        guestAccessToken = issued.token;
      }

      return { order, alreadyExisted: false, guestAccessToken };
    });
  };

  try {
    return await run();
  } catch (e) {
    if (e instanceof QuoteError) throw e;
    throw e;
  }
}

/** Stable scope for a guest, derived from their contact — a candidate, not proof. */
export function guestScope(phone: string, email?: string | null): string {
  const norm = `${phone.replace(/\D/g, "")}|${(email ?? "").trim().toLowerCase()}`;
  return `guest:${createHash("sha256").update(norm).digest("hex").slice(0, 24)}`;
}
