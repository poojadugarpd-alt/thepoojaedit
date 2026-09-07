import "server-only";

import type { PrismaClient } from "@/generated/prisma";

/**
 * Typed reads over the `StoreSettings` key/value table (master §3, §10). Values
 * are owner-confirmed before live checkout; the dev seed writes clearly-labelled
 * `_fixture: true` placeholders.
 */

export interface BusinessProfile {
  legalName: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  addressLines?: string[];
  supportEmail?: string;
}

export interface CheckoutRules {
  reservationTtlSeconds: number;
  codFeePaise: number;
}

const DEFAULT_CHECKOUT_RULES: CheckoutRules = {
  reservationTtlSeconds: 600,
  codFeePaise: 3000,
};

export interface ShippingPickup {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  stateName: string;
  stateCode: string;
  postcode: string;
  country: string;
}

export interface ShippingRules {
  pickup: ShippingPickup;
  /** Fallback per-parcel weight when a variant has no weight recorded. */
  defaultWeightGrams: number;
}

/** Clearly-labelled dev fixture; the owner confirms the real pickup before live. */
const DEFAULT_SHIPPING_RULES: ShippingRules = {
  pickup: {
    name: "The Pooja Edit (fixture)",
    phone: "+919999999999",
    line1: "Pickup address not configured",
    city: "New Delhi",
    stateName: "Delhi",
    stateCode: "07",
    postcode: "110001",
    country: "IN",
  },
  defaultWeightGrams: 400,
};

async function readSetting<T>(db: PrismaClient, key: string): Promise<T | null> {
  const row = await db.storeSettings.findUnique({ where: { key } });
  return row ? (row.value as T) : null;
}

export function getBusinessProfile(db: PrismaClient): Promise<BusinessProfile | null> {
  return readSetting<BusinessProfile>(db, "business.profile");
}

export async function getCheckoutRules(db: PrismaClient): Promise<CheckoutRules> {
  const v = await readSetting<Partial<CheckoutRules>>(db, "checkout.rules");
  return { ...DEFAULT_CHECKOUT_RULES, ...(v ?? {}) };
}

export async function getShippingRules(db: PrismaClient): Promise<ShippingRules> {
  const v = await readSetting<Partial<ShippingRules>>(db, "shipping.rules");
  return {
    pickup: { ...DEFAULT_SHIPPING_RULES.pickup, ...(v?.pickup ?? {}) },
    defaultWeightGrams:
      v?.defaultWeightGrams ?? DEFAULT_SHIPPING_RULES.defaultWeightGrams,
  };
}
