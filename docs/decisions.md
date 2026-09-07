# Decisions Log

Small implementation decisions (with date + reason) and any approved architectural changes. Architectural non-negotiables from the master specification are **not** changed here without the change-proposal procedure in playbook §17.

## Confirmed (carried from the master specification — recorded so no stale alternative resurfaces)

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-1 | Identity: **Supabase Auth** (with `@supabase/ssr` + `@supabase/supabase-js`). **Not** Auth.js/NextAuth. | 2026-09-07 | Master §1 latest-approved decision. No prior code holds a different choice. |
| D-2 | File storage: **Supabase Storage** (public `product-images`, private buckets for invoices/labels/documents). **Not** Cloudinary. | 2026-09-07 | Master §1 / §9. |
| D-3 | Database: **PostgreSQL** (Supabase Free). **Not** MongoDB. | 2026-09-07 | Master §1 / §2. |
| D-4 | ORM: **Prisma 7** with `@prisma/adapter-pg` + `pg` driver adapter; CLI datasource in `prisma.config.ts`. | 2026-09-07 | Master §2 / §3. Verified in Phase 0 that Prisma 7 is stable + production-recommended (see `compatibility-plan.md`). |
| D-5 | Framework: **Next.js 15 App Router** (15.5.x), React 19.2.x, Node 22 LTS on Vercel. | 2026-09-07 | Master §2. Phase 0 confirmed 15.5.x is still security-supported (Maintenance LTS). |
| D-6 | Single application, single commerce database, shared cart/checkout/order/payment/shipping/invoice/admin systems across both catalogs (`THE_POOJA_EDIT`, `THRIFT`). No independent per-catalog backends. | 2026-09-07 | Master §2 / §4. |
| D-7 | Tax: **STANDARD configurable GST** treatment only for now. `SECOND_HAND_MARGIN` reserved in schema/strategy but **disabled** in checkout; never inferred from acquisition cost. | 2026-09-07 | Master §6. |

## Phase 0 implementation decisions

| ID | Decision | Date | Reason |
| --- | --- | --- | --- |
| D-8 | Package manager: **npm** (`package-lock.json`, `packageManager: "npm@11.16.0"`). *Changed from the planned pnpm.* | 2026-09-07 | Corepack could not put a `pnpm` shim on PATH in this environment without extra privileges. npm 11 is already present, works, and Vercel supports it. Not an architecture choice; can revisit later with zero code impact. |
| D-9 | Tailwind CSS **v4** confirmed working — `create-next-app@15.5.25` scaffolds it (CSS-first `@import "tailwindcss"` + `@theme`), build + `sr-only` utilities verified. shadcn/ui CLI init deferred to the first phase that needs a component (Phase 4). | 2026-09-07 | Current supported default for Next 15 + React 19; no v3 fallback needed. |
| D-13 | **`overrides: { "postcss": "8.5.28" }`** in `package.json`. | 2026-09-07 | `create-next-app` pulled a `postcss` nested under `next` that `npm audit` flagged high (GHSA-qx2v-qp2m-jg93 + sourceMappingURL path-traversal chain, all fixed in 8.5.23+). The advisory's own "fix" bumps to Next 16, which the spec forbids. Forcing postcss to the patched 8.5.28 across the tree clears the finding (`npm audit` → 0) while staying on Next 15.5.25. Revisit/remove when Next 15.5.x ships a bundled postcss ≥ 8.5.23. |
| D-14 | **`APP_ENV` is derived from `NEXT_PUBLIC_APP_ENV` → `VERCEL_ENV` → `"development"`; `NODE_ENV` is deliberately ignored.** | 2026-09-07 | `next build` always sets `NODE_ENV=production`, so keying off it made every local/CI build look like the production *deployment* and trip the production env gate. Deployment identity ≠ build mode. Only a Vercel production deploy (`VERCEL_ENV=production`) or an explicit override is "production". Implemented in `src/lib/app-env.ts`, unit-tested. |
| D-15 | Vitest aliases **`server-only` / `client-only` to an empty stub** (`src/test/empty-module.ts`). | 2026-09-07 | Vitest does not set the `react-server` export condition, so importing the real `server-only` package throws. Aliasing is the standard workaround and does not weaken the boundary (the build still enforces it; verified no `pino`/server-only marker reaches `.next/static`). |
| D-16 | `engines.node` is `"22.x"` (not a hard `<23` ceiling); `.nvmrc` = `22`. Local dev on Node 24 works with one `EBADENGINE` warning. | 2026-09-07 | Vercel honours `22.x`; the warning is cosmetic. A strict ceiling would block the user's current machine for no real benefit. |
| D-10 | Spec files live at `docs/01-master-specification.md` and `docs/02-execution-playbook.md` inside the build repo, filenames preserved. Originals remain at `~/Documents/`. | 2026-09-07 | Playbook §1 instruction. |
| D-11 | Working records created as separate files under `docs/`: `build-progress.md`, `decisions.md`, `acceptance-evidence.md`, `integration-setup.md`, `operations-runbook.md`, plus Phase 0 deliverables `compatibility-plan.md`, `module-map.md`, `deferred-scope.md`. | 2026-09-07 | Playbook §1 required working records + Phase 0 deliverables. |
| D-12 | Exact runtime-critical package versions are pinned (non-caret) in Phase 1 and the resolved values written back into `compatibility-plan.md`. Phase 0 records the plan only; no `package.json` created yet. | 2026-09-07 | Playbook Phase 0: "Do not scaffold or replace the app until this checkpoint is complete." |

## Open items / proposals (not yet decided)

| ID | Item | Status |
| --- | --- | --- |
| D-open-1 | **Next.js 16 vs 15.** Master mandates 15; Next 16 is now Active LTS while 15.5.x is Maintenance LTS (still security-patched). Launching on 15.5.x is acceptable. If the Maintenance window threatens the launch/support horizon, raise an **architecture gate** proposal (compatibility, migration effort, affected ACs) before moving. | Watch — no action now |
| D-open-2 | ~~pnpm vs npm~~ — resolved as npm (D-8). | Closed 2026-09-07 |
| D-open-3 | Dev database choice: local Postgres (Docker) vs local Supabase CLI vs hosted Supabase dev project. Decide at start of Phase 2. | Deferred to Phase 2 |

## Architectural change procedure (reference)

Per playbook §17: write the exact proposed change, why the current architecture can't meet the need, alternatives, affected contracts/AC IDs, migration/backfill, compatibility, rollback, tests. Get explicit approval. Then update the master once, bump its version, link the decision here, adjust only affected playbook steps. A task-status edit must never smuggle in an architecture change.
