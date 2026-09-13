#!/usr/bin/env node
// Runs `prisma migrate deploy` only for an actual Production deployment.
//
// Vercel runs the same `vercel-build` script for Preview deployments too,
// and — until docs/release-candidate.md blocker #2 (a separate production
// Supabase project) is done — Preview currently points at the same
// database as Production. Auto-applying migrate deploy unconditionally
// would mean an unreviewed branch's migration silently lands on that
// shared database the moment its preview builds. Production only, always.
//
// This is the fix for the gap documented in decisions.md D-111: a migration
// was pushed and deployed (the built code already expected its new column)
// without ever being applied to the live database, because nothing in the
// build ran `prisma migrate deploy` — two separate manual steps that were
// not both done. Revisit this file's Preview-skip once blocker #2 lands and
// Preview has its own database; at that point Preview may be able to run
// migrate deploy too.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "(unset — not running on Vercel)";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[vercel-migrate] VERCEL_ENV=${env} — skipping migrate deploy (production only).`);
  process.exit(0);
}

console.log("[vercel-migrate] VERCEL_ENV=production — running prisma migrate deploy…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
