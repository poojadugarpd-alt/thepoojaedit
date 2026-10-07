#!/usr/bin/env node
// Runs `prisma migrate deploy` only for an actual Production deployment.
//
// Vercel runs the same `vercel-build` script for Preview deployments too.
// Since D-115 Preview has its own database (the dev Supabase project,
// Tokyo) and Production has `poojaedit-prod` (Mumbai), but an unreviewed
// branch's migration still shouldn't land anywhere the moment its preview
// builds. Production only, always; apply migrations to the dev project by
// hand (`npm run db:migrate:deploy` with .env.local pointing at it).
//
// This is the fix for the gap documented in decisions.md D-111: a migration
// was pushed and deployed (the built code already expected its new column)
// without ever being applied to the live database, because nothing in the
// build ran `prisma migrate deploy` — two separate manual steps that were
// not both done.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "(unset — not running on Vercel)";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[vercel-migrate] VERCEL_ENV=${env} — skipping migrate deploy (production only).`);
  process.exit(0);
}

console.log("[vercel-migrate] VERCEL_ENV=production — running prisma migrate deploy…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
