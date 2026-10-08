import "server-only";

import { createHash } from "node:crypto";

import type { CatalogType, PrismaClient } from "@/generated/prisma";
import {
  getBusinessProfile,
  getCheckoutRules,
  getShippingRules,
} from "@/server/settings";
import {
  allocateDiscount,
  assertCodeUsable,
  countActiveUses,
  DiscountCodeError,
  findCode,
} from "@/server/discounts";
import { computeOrderTax, type PricingMode } from "@/server/tax/calculator";
import { getQuoteProvider, type ShippingPort } from "@/server/shipping";

/**
 * Authoritative checkout quote (master §6, §7.1). Server prices only — any price
 * the browser sends is ignored. The quote carries an `expiresAt` and a `hash`
 * over the normalised request + server totals; checkout recomputes and rejects a
 * stale hash ("price changed, reconfirm").
 */

export class QuoteError extends Error {}
/** A discount code that can't be used; the message is shown under the code box. */
export class DiscountCodeQuoteError extends QuoteError {
  constructor(message: string) {
    super(message);
    this.name = "DiscountCodeQuoteError";
  }
}
export class ItemUnavailableError extends QuoteError {
  constructor(
    readonly variantId: string,
    reason: string,
    /** Shown to the shopper instead of the raw variant id when known. */
    title?: string,
  ) {
    super(title ? `${title}: ${reason}` : `Variant ${variantId}: ${reason}`);
    this.name = "ItemUnavailableError";
  }
}

export interface QuoteRequestLine {
  variantId: string;
  quantity: number;
}

export interface QuoteInput {
  lines: QuoteRequestLine[];
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  destination: { stateCode: string; postcode: string };
  /** What the shopper typed in the discount box (D-140), if anything. */
  discountCode?: string | null;
  shipping?: ShippingPort;
  now?: Date;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  catalog: CatalogType;
  sku: string;
  title: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPricePaise: number;
  hsnCode: string | null;
  taxTreatment: "STANDARD";
  taxRateBps: number;
  pricingMode: PricingMode;
  taxableValuePaise: number;
  /** This line's share of the code's discount, as a reduction of the taxable value. */
  discountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
  imageBucket: string | null;
  imagePath: string | null;
  returnPolicySnapshot: unknown;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  /** The applied code (stored form) and what it took off, tax included. */
  discountCode: string | null;
  discountCodeId: string | null;
  discountGrossPaise: number;
  currency: "INR";
  interState: boolean;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  paymentMethod: "PREPAID_RAZORPAY" | "COD";
  reservationTtlSeconds: number;
  expiresAt: Date;
  hash: string;
  /** Shadowfax couldn't confirm delivery to this PIN (its check errored). */
  serviceabilityUnconfirmed: boolean;
}

function hashQuote(parts: {
  lines: {
    variantId: string;
    quantity: number;
    unitPricePaise: number;
    taxRateBps: number;
  }[];
  paymentMethod: string;
  placeOfSupplyStateCode: string;
  discountCode: string | null;
  discountPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
}): string {
  const canon = JSON.stringify({
    l: parts.lines
      .map((l) => [l.variantId, l.quantity, l.unitPricePaise, l.taxRateBps])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    pm: parts.paymentMethod,
    pos: parts.placeOfSupplyStateCode,
    dc: parts.discountCode,
    d: parts.discountPaise,
    s: parts.subtotalPaise,
    sh: parts.shippingPaise,
    cf: parts.codFeePaise,
    t: parts.taxPaise,
    tot: parts.totalPaise,
  });
  return createHash("sha256").update(canon).digest("hex").slice(0, 32);
}

const RETURN_POLICY: Record<CatalogType, unknown> = {
  THE_POOJA_EDIT: { windowHours: 48, kind: "size-exchange", finalSale: false },
  THRIFT: { windowHours: 0, kind: "none", finalSale: true },
};

export async function computeQuote(
  db: PrismaClient,
  input: QuoteInput,
): Promise<Quote> {
  if (input.lines.length === 0) throw new QuoteError("Cart is empty.");
  for (const l of input.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new QuoteError(`Invalid quantity for ${l.variantId}.`);
    }
  }

  const [profile, rules, shippingRules] = await Promise.all([
    getBusinessProfile(db),
    getCheckoutRules(db),
    getShippingRules(db),
  ]);
  const supplierStateCode = profile?.stateCode ?? "";
  const placeOfSupplyStateCode = input.destination.stateCode;
  const interState =
    Boolean(supplierStateCode) && supplierStateCode !== placeOfSupplyStateCode;

  const now = input.now ?? new Date();
  const shipping = input.shipping ?? getQuoteProvider();

  const variants = await db.productVariant.findMany({
    where: { id: { in: input.lines.map((l) => l.variantId) } },
    include: { product: { include: { taxClass: { include: { rules: true } } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  // Build tax-calculator lines + line snapshots
  type BaseLine = Omit<
    QuoteLine,
    | "taxRateBps"
    | "pricingMode"
    | "taxableValuePaise"
    | "discountPaise"
    | "cgstPaise"
    | "sgstPaise"
    | "igstPaise"
    | "lineTotalPaise"
  >;
  const taxLines: Parameters<typeof computeOrderTax>[0]["lines"] = [];
  const base: BaseLine[] = [];

  for (const reqLine of input.lines) {
    const v = byId.get(reqLine.variantId);
    if (!v) throw new ItemUnavailableError(reqLine.variantId, "not found");
    if (!v.isActive)
      throw new ItemUnavailableError(v.id, "no longer available", v.product.title);
    if (v.product.status !== "PUBLISHED" || v.product.publishedAt == null) {
      throw new ItemUnavailableError(v.id, "no longer available", v.product.title);
    }
    if (v.product.markedSoldOut) {
      throw new ItemUnavailableError(
        v.id,
        "sold out — please remove it from your cart",
        v.product.title,
      );
    }
    const available = v.onHandQty - v.reservedQty;
    if (available < reqLine.quantity) {
      throw new ItemUnavailableError(
        v.id,
        `only ${available} available`,
        v.product.title,
      );
    }

    const rule =
      v.product.taxClass?.rules
        .filter(
          (r) =>
            r.effectiveFrom <= now && (r.effectiveTo == null || r.effectiveTo > now),
        )
        .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ??
      null;
    // Default to a zero-rate STANDARD inclusive rule if none configured (dev).
    const pricingMode: PricingMode = rule?.pricingMode ?? "INCLUSIVE";
    const totalRateBps = rule?.totalRateBps ?? 0;

    taxLines.push({
      unitPricePaise: v.pricePaise,
      quantity: reqLine.quantity,
      rule: { treatment: "STANDARD" as const, pricingMode, totalRateBps },
      interState,
    });
    base.push({
      variantId: v.id,
      productId: v.productId,
      catalog: v.product.catalog,
      sku: v.sku,
      title: v.product.title,
      size: v.size,
      color: v.color,
      quantity: reqLine.quantity,
      unitPricePaise: v.pricePaise,
      hsnCode: v.product.hsnCode ?? v.product.taxClass?.hsnCode ?? null,
      taxTreatment: "STANDARD",
      imageBucket: null,
      imagePath: null,
      returnPolicySnapshot: RETURN_POLICY[v.product.catalog],
    });
  }

  const orderValueEstimate = taxLines.reduce(
    (s, l) => s + l.unitPricePaise * l.quantity,
    0,
  );
  const shipQuote = await shipping.quote({
    destinationPostcode: input.destination.postcode,
    items: [{ weightGrams: 0, quantity: 1 }],
    paymentMethod: input.paymentMethod,
    orderValuePaise: orderValueEstimate,
  });
  if (!shipQuote.serviceable) {
    throw new QuoteError(shipQuote.reason ?? "Address not serviceable.");
  }
  if (input.paymentMethod === "COD" && !shipQuote.codAllowed) {
    throw new QuoteError("Cash on delivery is not available for this order.");
  }

  // The provider only answers serviceability/COD; the fee is the store's own
  // rule — ₹100 once if any Closet piece is in the cart, else free (D-137).
  const shippingPaise = base.some((l) => l.catalog === "THRIFT")
    ? shippingRules.fees.withClosetPaise
    : shippingRules.fees.labelOnlyPaise;

  // Discount code (D-140): validated against live uses, then spread over the
  // lines it applies to as each line's pre-tax reduction.
  let discountCode: string | null = null;
  let discountCodeId: string | null = null;
  let discountGrossPaise = 0;
  if (input.discountCode?.trim()) {
    const row = await findCode(db, input.discountCode);
    try {
      const usedCount = row
        ? await countActiveUses(db, row.id, {
            now,
            ttlSeconds: rules.reservationTtlSeconds,
          })
        : 0;
      assertCodeUsable(row, { now, usedCount });
      const alloc = allocateDiscount(
        row,
        base.map((l) => ({
          catalog: l.catalog,
          grossPaise: l.unitPricePaise * l.quantity,
        })),
      );
      alloc.perLinePaise.forEach((d, i) => {
        taxLines[i].discountPaise = d;
      });
      discountCode = row.code;
      discountCodeId = row.id;
      discountGrossPaise = alloc.totalPaise;
    } catch (e) {
      if (e instanceof DiscountCodeError) throw new DiscountCodeQuoteError(e.message);
      throw e;
    }
  }

  const tax = computeOrderTax({
    lines: taxLines,
    shippingPaise,
    codFeePaise: input.paymentMethod === "COD" ? shipQuote.codFeePaise : 0,
  });

  const lines: QuoteLine[] = base.map((p, i) => {
    const t = tax.lines[i];
    return {
      ...p,
      taxRateBps: t.rateBps,
      pricingMode: t.pricingMode,
      taxableValuePaise: t.taxableValuePaise,
      discountPaise: t.discountPaise,
      cgstPaise: t.split.cgstPaise,
      sgstPaise: t.split.sgstPaise,
      igstPaise: t.split.igstPaise,
      lineTotalPaise: t.lineTotalPaise,
    };
  });

  const hash = hashQuote({
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      taxRateBps: l.taxRateBps,
    })),
    paymentMethod: input.paymentMethod,
    placeOfSupplyStateCode,
    discountCode,
    discountPaise: tax.discountPaise,
    subtotalPaise: tax.subtotalPaise,
    shippingPaise: tax.shippingPaise,
    codFeePaise: tax.codFeePaise,
    taxPaise: tax.taxPaise,
    totalPaise: tax.totalPaise,
  });

  return {
    lines,
    subtotalPaise: tax.subtotalPaise,
    discountPaise: tax.discountPaise,
    shippingPaise: tax.shippingPaise,
    codFeePaise: tax.codFeePaise,
    taxPaise: tax.taxPaise,
    totalPaise: tax.totalPaise,
    discountCode,
    discountCodeId,
    discountGrossPaise,
    currency: "INR",
    interState,
    supplierStateCode,
    placeOfSupplyStateCode,
    paymentMethod: input.paymentMethod,
    reservationTtlSeconds: rules.reservationTtlSeconds,
    serviceabilityUnconfirmed: shipQuote.serviceabilityUnconfirmed === true,
    expiresAt: new Date(now.getTime() + rules.reservationTtlSeconds * 1000),
    hash,
  };
}
