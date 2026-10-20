import "server-only";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

import { DEFAULT_SALE, getSaleSettings, type SaleSettings } from "./index";

/** Cache tag busted when the sale is saved in Admin → Discount codes. */
export const SALE_TAG = "sale";

/**
 * The sale setting for the countdown bar, which renders on every page. Whether
 * it is still running is decided by the caller against the current time; a
 * database hiccup just hides the bar (checkout reads the setting uncached).
 */
export const getCachedSaleSettings = unstable_cache(
  async (): Promise<SaleSettings> => {
    try {
      return await getSaleSettings(prisma);
    } catch {
      return DEFAULT_SALE;
    }
  },
  ["sale-settings"],
  { tags: [SALE_TAG], revalidate: 60 },
);
