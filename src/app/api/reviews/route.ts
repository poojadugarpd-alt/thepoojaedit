import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { APP_ENV } from "@/lib/app-env";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { publicEnv } from "@/lib/public-env";
import {
  hashIp,
  listApprovedReviews,
  ReviewRateLimitError,
  submitReview,
} from "@/server/reviews";

/**
 * Public review API, used by the styling page here and by the editing studio
 * (studio.thepoojaedit.in) from the browser.
 *
 *  POST  save a review as PENDING (nothing shows until Pooja approves it)
 *  GET   approved reviews only, public fields only: ?site=studio|styling
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STUDIO_ORIGIN = "https://studio.thepoojaedit.in";

function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin,
    STUDIO_ORIGIN,
  ]);
  if (APP_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3100");
  }
  return origins;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req), ...extra },
  });
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

async function turnstileOk(token: unknown, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet: the other protections still apply
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) {
    return json(req, { ok: false, error: "forbidden" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, { ok: false, error: "bad_request" }, 400);
  }

  // Honeypot: bots fill every field. Pretend it worked.
  if (typeof body.company === "string" && body.company.trim()) {
    return json(req, { ok: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  if (!(await turnstileOk(body.turnstileToken, ip))) {
    return json(req, { ok: false, error: "check_failed" }, 400);
  }

  try {
    await submitReview(prisma, body, {
      inviteToken: typeof body.invite === "string" ? body.invite : null,
      ipHash: ip ? hashIp(ip) : null,
    });
    return json(req, { ok: true });
  } catch (e) {
    if (e instanceof ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = String(issue.path[0] ?? "form");
        errors[key] ??= issue.message;
      }
      return json(req, { ok: false, errors }, 422);
    }
    if (e instanceof ReviewRateLimitError) {
      return json(req, { ok: false, error: "rate_limited" }, 429);
    }
    logger.error(
      { err: e instanceof Error ? e.message : String(e) },
      "review submit failed",
    );
    return json(req, { ok: false, error: "server_error" }, 500);
  }
}

export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get("site");
  if (site !== "studio" && site !== "styling") {
    return json(req, { ok: false, error: "bad_site" }, 400);
  }
  const reviews = await listApprovedReviews(
    prisma,
    site === "studio" ? "STUDIO" : "STYLING",
  );
  return json(req, { ok: true, reviews }, 200, {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  });
}
