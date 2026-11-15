import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  runReconciliation,
  runReservationSweep,
  runStaleOutboxAlert,
} from "@/server/events";
import {
  getPaymentProvider,
  isPrepaidConfigured,
  makePaymentReconcilePort,
} from "@/server/payments";
import {
  getFulfilmentProvider,
  isShippingConfigured,
  makeShipmentReconcilePort,
} from "@/server/shipping";
import { makeRefundReconcilePort } from "@/server/refunds/service";
import { dispatchInline } from "@/server/outbox-inline";
import { archiveSoldClosetPieces } from "@/server/catalog/sold-archive";
import { cancelAbandonedCheckouts } from "@/server/orders/lifecycle";
import {
  compressProductPhoto,
  listUncompressedPhotoIds,
  livePhotoDeps,
} from "@/server/catalog/compress-photos";
import {
  listPhotosNotOnR2,
  liveMoveDeps,
  moveHomeMediaToR2,
  moveProductPhotoToR2,
} from "@/server/catalog/move-photos-to-r2";
import {
  deleteSupabasePhotosFromManifest,
  liveCleanupDeps,
  writeSupabasePhotoManifest,
} from "@/server/catalog/supabase-photo-cleanup";

import { inngest } from "./client";

/**
 * FREE-PLAN BUDGET (Inngest Hobby = 50,000 executions/month, and a function
 * run plus each of its `step.run` calls count separately; once the limit is hit
 * Inngest stops starting every job until the month resets).
 *
 * The previous setup used ~6,500/day: a dispatcher every minute, a sweep every
 * 2, six more crons every 5-15 minutes, and five event consumers that each ran
 * for EVERY order event (mostly just to skip). It ran dry in about a week.
 *
 * Now the time-critical work (emails, admin alert + phone push, invoice,
 * shipment, late-capture refund) runs inside the app straight after an order
 * event (`src/server/outbox-inline.ts`). Inngest keeps ONE lightweight
 * safety-net job, every 15 minutes, with no `step.run` wrappers:
 * 96 runs/day = about 2,900/month, leaving ~95% of the allowance free for the
 * admin-started photo jobs below. Do not add crons or per-event functions
 * without re-doing this arithmetic.
 */

/** Admin-started: shrink heavy product photos in batches (D-158). */
export const compressProductPhotos = inngest.createFunction(
  { id: "compress-product-photos", concurrency: 1, retries: 2 },
  { event: "poojaedit/photos.compress.requested" },
  async ({ event, step }) => {
    const { adminUserId } = event.data as { adminUserId: string };
    const ids = await step.run("list", () => listUncompressedPhotoIds(prisma));
    logger.info({ photos: ids.length }, "photo compression: started");
    const totals = { compressed: 0, skipped: 0, failed: 0, savedBytes: 0 };
    for (let i = 0; i < ids.length; i += 8) {
      const batch = ids.slice(i, i + 8);
      const r = await step.run(`batch-${i / 8}`, async () => {
        const deps = await livePhotoDeps();
        const out = { compressed: 0, skipped: 0, failed: 0, savedBytes: 0 };
        const reasons: Record<string, number> = {};
        for (const imageId of batch) {
          try {
            const res = await compressProductPhoto(prisma, deps, {
              imageId,
              adminUserId,
            });
            if (res.outcome === "compressed") {
              out.compressed += 1;
              out.savedBytes += res.beforeBytes - res.afterBytes;
            } else {
              out.skipped += 1;
              reasons[res.reason] = (reasons[res.reason] ?? 0) + 1;
            }
          } catch (e) {
            out.failed += 1;
            logger.warn({ imageId, err: String(e) }, "photo compression failed");
          }
        }
        logger.info({ batch: i / 8, ...out, reasons }, "photo compression: batch done");
        return out;
      });
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
    }
    logger.info(totals, "photo compression: finished");
    return totals;
  },
);

/** Admin-started: copy every public photo from Supabase to Cloudflare R2 (D-159). */
export const movePhotosToR2 = inngest.createFunction(
  { id: "move-photos-to-r2", concurrency: 1, retries: 2 },
  { event: "poojaedit/photos.move-to-r2.requested" },
  async ({ event, step }) => {
    const { adminUserId } = event.data as { adminUserId: string };
    const home = await step.run("home-media", async () =>
      moveHomeMediaToR2(prisma, await liveMoveDeps(), adminUserId),
    );
    logger.info(home, "R2 move: home media done");
    const ids = await step.run("list", () => listPhotosNotOnR2(prisma));
    logger.info({ photos: ids.length }, "R2 move: started");
    const totals = { moved: 0, skipped: 0, failed: 0, bytes: 0 };
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const r = await step.run(`batch-${i / 10}`, async () => {
        const deps = await liveMoveDeps();
        const out = { moved: 0, skipped: 0, failed: 0, bytes: 0 };
        const reasons: Record<string, number> = {};
        for (const imageId of batch) {
          try {
            const res = await moveProductPhotoToR2(prisma, deps, {
              imageId,
              adminUserId,
            });
            if (res.outcome === "moved") {
              out.moved += 1;
              out.bytes += res.bytes;
            } else {
              out.skipped += 1;
              reasons[res.reason] = (reasons[res.reason] ?? 0) + 1;
            }
          } catch (e) {
            out.failed += 1;
            logger.warn({ imageId, err: String(e) }, "R2 move failed");
          }
        }
        logger.info({ batch: i / 10, ...out, reasons }, "R2 move: batch done");
        return out;
      });
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
    }
    logger.info(totals, "R2 move: finished");
    return { home, ...totals };
  },
);

/** Admin-started: save the list of Supabase photo files to R2 for backup (D-161). */
export const listSupabasePhotos = inngest.createFunction(
  { id: "list-supabase-photos", concurrency: 1, retries: 2 },
  { event: "poojaedit/photos.supabase-list.requested" },
  async ({ event, step }) => {
    const { adminUserId } = event.data as { adminUserId: string };
    const r = await step.run("manifest", async () =>
      writeSupabasePhotoManifest(prisma, await liveCleanupDeps(prisma), {
        adminUserId,
      }),
    );
    logger.info(r, "Supabase photo list saved");
    return r;
  },
);

/** Admin-started: delete the Supabase photo copies in one backed-up list (D-161). */
export const deleteSupabasePhotos = inngest.createFunction(
  { id: "delete-supabase-photos", concurrency: 1, retries: 1 },
  { event: "poojaedit/photos.supabase-delete.requested" },
  async ({ event, step }) => {
    const { adminUserId, manifestKey } = event.data as {
      adminUserId: string;
      manifestKey: string;
    };
    const r = await step.run("delete", async () =>
      deleteSupabasePhotosFromManifest(prisma, await liveCleanupDeps(prisma), {
        manifestKey,
        adminUserId,
      }),
    );
    logger.info({ manifestKey, ...r }, "Supabase photo delete finished");
    return r;
  },
);


/**
 * The single scheduled job. Each task is isolated so one failure never stops
 * the rest; the return value is what shows in the Inngest run log.
 */
export const housekeeping = inngest.createFunction(
  { id: "housekeeping", concurrency: 1 },
  { cron: "*/15 * * * *" },
  async () => {
    const out: Record<string, unknown> = {};
    const task = async (name: string, fn: () => Promise<unknown>) => {
      try {
        out[name] = await fn();
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        logger.error({ err, task: name }, "housekeeping task failed");
        out[name] = { error: err };
      }
    };

    // Delivers anything the in-app dispatch missed (a crash, a deploy mid-send).
    await task("dispatch-outbox", dispatchInline);
    await task("sweep-reservations", () => runReservationSweep(prisma));
    await task("cancel-unpaid-checkouts", () => cancelAbandonedCheckouts(prisma));
    await task("outbox-health", () => runStaleOutboxAlert(prisma));
    if (isPrepaidConfigured()) {
      await task("reconcile-payments", () =>
        runReconciliation([makePaymentReconcilePort(prisma, getPaymentProvider())]),
      );
      await task("reconcile-refunds", () =>
        runReconciliation([makeRefundReconcilePort(prisma, getPaymentProvider())]),
      );
    }
    if (isShippingConfigured()) {
      await task("reconcile-shipments", () =>
        runReconciliation([makeShipmentReconcilePort(prisma, getFulfilmentProvider())]),
      );
    }
    // Sold Closet pieces are archived once an hour (D-143).
    if (new Date().getUTCMinutes() < 15) {
      await task("archive-sold-closet", async () => {
        const result = await archiveSoldClosetPieces(prisma);
        if (result.archived.length > 0) {
          logger.info({ archived: result.archived }, "archived sold Closet pieces");
        }
        return { archived: result.archived.length };
      });
    }
    return out;
  },
);

export const functions = [
  housekeeping,
  compressProductPhotos,
  movePhotosToR2,
  listSupabasePhotos,
  deleteSupabasePhotos,
];
