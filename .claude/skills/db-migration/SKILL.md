---
name: db-migration
description: Walk through adding a Prisma migration to PoojaEdit safely — expand, backfill, validate, switch, contract. Use whenever a real schema change is needed against the production/staging Postgres, not just local dev.
---

# Adding a Prisma migration safely

PoojaEdit runs two real Supabase Postgres projects (`poojaedit-prod` and a
dev/staging project) with real customer/order data in prod. The project's own
stated norm (`docs/HANDOVER.md` §3): **one additive migration per real schema
need; never `prisma db push`/`migrate reset` against data that matters;
expand → backfill → validate → switch → contract.**

A `PreToolUse` hook (`.claude/hooks/block-destructive-prisma.sh`) blocks raw
`prisma migrate reset`/`db push`/`db execute` outside the vetted `npm run
db:*` scripts — this skill is the safe procedure for the cases that hook
doesn't (and shouldn't) cover: adding a genuinely new migration.

## Procedure

1. **Expand**: write an additive-only migration (`npx prisma migrate dev
   --name <descriptive_name>` locally against `npm run db:dev`'s embedded
   Postgres, never against staging/prod). New columns nullable or with a
   default; new tables; never a destructive rename/drop in the same
   migration as new-data-dependent logic. Match the precedent of past
   migrations — check `prisma/migrations/` for the most recent 2-3 to match
   naming/style (e.g. `20260915071559_add_product_tags`).
2. **Backfill**: if existing rows need populating under the new shape, write
   the backfill as its own explicit step (script under `scripts/`, or a data
   migration), not silently inside application code that only runs
   incidentally.
3. **Validate**: run the full local suite — `npm run check` (lint, typecheck,
   unit, build) plus `npm run test:integration` (this project's integration
   tests hit a real local Postgres, not mocks) — before touching a real
   remote database.
4. **Switch**: deploy the migration with `npm run db:migrate:deploy` (or
   however the vercel-build hook applies it — check
   `scripts/vercel-migrate.mjs`), to staging first if the change is at all
   risky, then prod. Re-verify against the actual live database after
   deploying — this project has a documented pattern (D-111/D-112, D-120) of
   fixes that worked locally but weren't re-verified against the real
   Supabase project/live env vars.
5. **Contract**: only after the new shape is live and proven, add a
   follow-up migration to drop old columns/tables/nullability — as its own
   separate, later migration, never bundled with the expand step.

## Before starting

- Confirm with the user which environment this targets (local only vs.
  staging vs. prod) — don't assume.
- Check `docs/decisions.md` for whether a similar migration was already
  planned/attempted (search for the table/column name).
- After the migration ships, log it via the `log-decision` skill.
