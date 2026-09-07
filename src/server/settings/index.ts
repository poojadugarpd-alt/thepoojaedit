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
