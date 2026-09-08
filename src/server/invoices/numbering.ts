import "server-only";

import type { Prisma } from "@/generated/prisma";

/**
 * Indian financial year (1 Apr – 31 Mar) as `"YYYY-YY"`, e.g. a date in
 * March 2026 → `"2025-26"`, in April 2026 → `"2026-27"`.
 */
export function financialYearFor(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1; // Apr (3) starts the FY
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYY}`;
}

/**
 * Atomically allocate the next invoice number for `(financialYear, series)`.
 * A single `INSERT … ON CONFLICT DO UPDATE` takes the row lock, so concurrent
 * callers serialise and each gets a distinct number. Run this INSIDE the same
 * transaction as the `Invoice` insert — if that insert loses an
 * `@@unique([orderId])` race the whole transaction rolls back and the number is
 * not consumed (no gap).
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  input: { financialYear: string; series: string },
): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ allocated: number }[]>(
    `INSERT INTO "InvoiceSequence" ("id", "financialYear", "series", "nextNumber", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 2, now())
     ON CONFLICT ("financialYear", "series")
       DO UPDATE SET "nextNumber" = "InvoiceSequence"."nextNumber" + 1, "updatedAt" = now()
     RETURNING ("nextNumber" - 1) AS allocated`,
    input.financialYear,
    input.series,
  );
  return rows[0].allocated;
}

/** Human-facing invoice number: `PE/2026-27/A/000042`. */
export function formatInvoiceNumber(
  financialYear: string,
  series: string,
  number: number,
): string {
  return `PE/${financialYear}/${series}/${String(number).padStart(6, "0")}`;
}
