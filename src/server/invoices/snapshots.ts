import "server-only";

import type { Order, OrderAddress, OrderItem } from "@/generated/prisma";
import type { BusinessProfile } from "@/server/settings";

/**
 * Build the immutable invoice snapshots (master §6). Everything is copied by
 * value from the order — which itself already holds immutable `OrderItem` /
 * `OrderAddress` snapshots from Phase 5 — so a later product, price or tax edit
 * can never change an issued invoice.
 */

export interface InvoiceSnapshots {
  legalSnapshot: Record<string, unknown>;
  addressSnapshot: Record<string, unknown>;
  lineSnapshot: unknown[];
  taxSnapshot: Record<string, unknown>;
}

function addr(a: OrderAddress | undefined) {
  if (!a) return null;
  return {
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    stateName: a.stateName,
    stateCode: a.stateCode,
    postcode: a.postcode,
    country: a.country,
  };
}

export function buildInvoiceSnapshots(input: {
  order: Order;
  items: OrderItem[];
  addresses: OrderAddress[];
  business: BusinessProfile | null;
  financialYear: string;
  series: string;
  number: number;
  issuedAt: Date;
}): InvoiceSnapshots {
  const { order, items, addresses, business } = input;
  const billing = addresses.find((a) => a.type === "BILLING");
  const shipping = addresses.find((a) => a.type === "SHIPPING");

  const isFixture =
    !business || business.legalName.toLowerCase().includes("fixture") || !business.gstin;

  const byRate = new Map<
    number,
    { rateBps: number; taxableValuePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
  >();
  for (const i of items) {
    const g = byRate.get(i.taxRateBps) ?? {
      rateBps: i.taxRateBps,
      taxableValuePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    };
    g.taxableValuePaise += i.taxableValuePaise;
    g.cgstPaise += i.cgstPaise;
    g.sgstPaise += i.sgstPaise;
    g.igstPaise += i.igstPaise;
    byRate.set(i.taxRateBps, g);
  }

  const cgstPaise = items.reduce((s, i) => s + i.cgstPaise, 0);
  const sgstPaise = items.reduce((s, i) => s + i.sgstPaise, 0);
  const igstPaise = items.reduce((s, i) => s + i.igstPaise, 0);
  const interState = igstPaise > 0;

  const taxBreakdown = (order.taxBreakdown ?? {}) as { mode?: string };

  return {
    legalSnapshot: {
      seller: {
        legalName: business?.legalName ?? "The Pooja Edit (fixture)",
        gstin: business?.gstin ?? null,
        stateName: business?.stateName ?? null,
        stateCode: business?.stateCode ?? null,
        addressLines: business?.addressLines ?? [],
        supportEmail: business?.supportEmail ?? null,
      },
      isFixture,
      invoiceNumber: `PE/${input.financialYear}/${input.series}/${String(input.number).padStart(6, "0")}`,
      financialYear: input.financialYear,
      series: input.series,
      number: input.number,
      issuedAt: input.issuedAt.toISOString(),
      orderNumber: order.orderNumber,
      placedAt: order.placedAt?.toISOString() ?? null,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      placeOfSupplyStateCode: shipping?.stateCode ?? null,
      reverseCharge: false,
      note: isFixture
        ? "DRAFT / DEV FIXTURE — not a valid tax invoice. Real GSTIN and rates are owner-confirmed before live issuance."
        : null,
    },
    addressSnapshot: { billing: addr(billing), shipping: addr(shipping) },
    lineSnapshot: items.map((i) => ({
      sku: i.sku,
      title: i.title,
      catalog: i.catalog,
      hsnCode: i.hsnCode,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unitPricePaise: i.unitPricePaise,
      discountPaise: i.discountPaise,
      taxTreatment: i.taxTreatment,
      taxRateBps: i.taxRateBps,
      taxableValuePaise: i.taxableValuePaise,
      cgstPaise: i.cgstPaise,
      sgstPaise: i.sgstPaise,
      igstPaise: i.igstPaise,
      totalPaise: i.totalPaise,
    })),
    taxSnapshot: {
      mode: taxBreakdown.mode ?? "INCLUSIVE",
      interState,
      cgstPaise,
      sgstPaise,
      igstPaise,
      taxPaise: order.taxPaise,
      shippingPaise: order.shippingPaise,
      codFeePaise: order.codFeePaise,
      roundOffPaise: 0,
      breakdownByRate: [...byRate.values()].sort((a, b) => a.rateBps - b.rateBps),
    },
  };
}
