import { NextResponse } from "next/server";

import { APP_ENV } from "@/lib/app-env";
import { scopedLogger } from "@/lib/logger";

/**
 * Liveness/health endpoint. No authentication, no secrets in the response.
 * Dependency checks (database, providers) are added in their phases behind an
 * explicit `?deep=1` so this stays a cheap liveness probe by default.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export function GET() {
  const body = {
    status: "ok" as const,
    env: APP_ENV,
    service: "poojaedit",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  };

  scopedLogger({ route: "health" }).debug(body, "health check");

  return NextResponse.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
