import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { APP_ENV } from "@/lib/app-env";
import { productPath } from "@/lib/catalog-routes";
import { logger } from "@/lib/logger";
import { publicEnv } from "@/lib/public-env";

/**
 * IndexNow (D-177): tell Bing (and the other IndexNow engines; ChatGPT search
 * reads Bing) the moment a product page changes, instead of waiting for a
 * crawl. The key is public by design: it is served at `/<key>.txt`
 * (`public/`) so the engines can check the ping came from this site.
 * Production only; a failed ping is logged and never affects the save.
 */
export const INDEXNOW_KEY = "81f57ce0a7c4cc1437d40716cb424d82";

const ENDPOINT = "https://api.indexnow.org/indexnow";

export function indexNowBody(paths: string[], base: string) {
  const origin = new URL(base);
  return {
    host: origin.host,
    key: INDEXNOW_KEY,
    keyLocation: `${origin.origin}/${INDEXNOW_KEY}.txt`,
    urlList: [...new Set(paths)].map((p) => new URL(p, origin).toString()),
  };
}

type Deps = { fetch: typeof fetch; appEnv: string; base: string };
const liveDeps: Deps = {
  fetch: (...args) => fetch(...args),
  appEnv: APP_ENV,
  base: publicEnv.NEXT_PUBLIC_SITE_URL,
};

export async function pingIndexNow(
  paths: string[],
  deps: Deps = liveDeps,
): Promise<void> {
  if (deps.appEnv !== "production" || paths.length === 0) return;
  try {
    const res = await deps.fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(paths, deps.base)),
    });
    // 200 and 202 both mean accepted.
    if (!res.ok) logger.warn({ status: res.status, paths }, "indexnow ping refused");
  } catch (err) {
    logger.warn({ err, paths }, "indexnow ping failed");
  }
}

/**
 * A product's page and its catalogue listing, for a ping after it changes.
 * Drafts are skipped: they were never public (a 404), so there's nothing to recrawl.
 */
export async function pingProduct(db: PrismaClient, productId: string): Promise<void> {
  const p = await db.product
    .findUnique({
      where: { id: productId },
      select: { catalog: true, slug: true, status: true },
    })
    .catch(() => null);
  if (!p || p.status === "DRAFT") return;
  const path = productPath(p.catalog, p.slug);
  await pingIndexNow([path, path.slice(0, path.lastIndexOf("/"))]);
}
