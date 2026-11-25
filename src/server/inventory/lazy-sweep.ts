import "server-only";

import type { PrismaClient } from "@poojaedit/db";
import { logger } from "@/lib/logger";

import { expireReservations } from "./reservations";

/**
 * Release expired stock holds from inside the app.
 *
 * A prepaid checkout holds its stock for ~10 minutes (D-150). The hold is
 * only given back by `expireReservations`, which used to run from an Inngest
 * cron every 2 minutes. When the free Inngest plan ran out (Nov 2026) nothing
 * released abandoned holds, so a one-of-one piece whose buyer walked away
 * stayed "On hold" for everyone else. This does the same release on demand:
 * whenever a shop page or checkout needs fresh stock numbers, at most once
 * every `MIN_INTERVAL_MS` per server instance. It is the same single SQL step
 * (`FOR UPDATE SKIP LOCKED`), so instances running it at once, or the
 * housekeeping cron running it too, can never double-release.
 *
 * Never throws: a failed sweep must not break a page.
 */
export const MIN_INTERVAL_MS = 15_000;

let lastRunAt = 0;
let inFlight: Promise<void> | null = null;

export async function sweepExpiredHolds(
  db: PrismaClient,
  opts: { force?: boolean; now?: number } = {},
): Promise<void> {
  const now = opts.now ?? Date.now();
  if (inFlight) {
    // Someone is already sweeping; wait for that rather than start a second.
    await inFlight;
    return;
  }
  if (!opts.force && now - lastRunAt < MIN_INTERVAL_MS) return;
  lastRunAt = now;
  inFlight = db
    .$transaction((tx) => expireReservations(tx, { limit: 100 }))
    .then((released) => {
      if (released > 0) logger.info({ released }, "released expired stock holds");
    })
    .catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "hold sweep failed");
    })
    .finally(() => {
      inFlight = null;
    });
  await inFlight;
}

/** Test helper: forget the throttle so each test starts fresh. */
export function resetLazySweepForTests(): void {
  lastRunAt = 0;
  inFlight = null;
}
