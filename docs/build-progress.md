# Build Progress

Stable architecture: [01-master-specification.md](01-master-specification.md) · Execution control: [02-execution-playbook.md](02-execution-playbook.md)

Status vocabulary: `not-started` · `in-progress` · `blocked` · `passed`

## Current position

| Field | Value |
| --- | --- |
| Authorized phase range | Phases 0–3 |
| Current phase | Phase 3 — Authentication, authorization and asset storage |
| Phase 0 status | `passed` (2026-09-07) |
| Phase 1 status | `passed` (2026-09-07) |
| Phase 2 status | `passed` (2026-09-07) — schema review gate (still open for sign-off) |
| Phase 3 status | `passed (partial)` (2026-09-07) — **security review gate**: local slice done + tested; live Supabase security evidence deferred until a dev project exists |
| Last commit | _see git log — Phase 0 / 1 / 2 / `feat: Phase 3 auth, guards, guest tokens, storage`_ |
| Tests run | Phase 3: `npm run check` ✓ (lint/type/**unit 34**/build) · `npm run test:integration` ✓ **38/38** (real PostgreSQL) · no secrets in client bundle ✓ |
| Next task | Create a Supabase dev project (`docs/supabase-setup.md`) to unblock the deferred Phase 3 security checks; then authorize Phase 4 |

## Phase ledger

| Phase | Title | Status | Commit | Evidence |
| --- | --- | --- | --- | --- |
| 0 | Inspect and freeze the implementation baseline | `passed` | `docs: Phase 0 baseline` | This file + `compatibility-plan.md`, `module-map.md`, `acceptance-evidence.md`, `integration-setup.md`, `operations-runbook.md`, `decisions.md`, `deferred-scope.md` |
| 1 | Application foundation and environment isolation | `passed` | `chore: Phase 1 application foundation` | Next.js 15.5.25 app; `src/lib/{app-env,env,public-env,logger,money}.ts`; domain folders `src/server/*`, `src/features/*`; `/api/health`; middleware; instrumentation; Vitest (19) + Playwright (4) harness; `.github/workflows/ci.yml`; `.env.example`. See "Phase 1 checkpoint" below. |
| 2 | Database, migrations, Prisma and business schema | `passed` (review gate) | `feat: Phase 2 database + Prisma 7 schema` | `prisma/schema.prisma` (42 models, master §5); `prisma/migrations/` (init + `manual_constraints`); `prisma.config.ts`; `src/lib/db.ts` (adapter-pg singleton); `prisma/seed.ts` (idempotent fixtures); `scripts/{pg,db-dev}.ts` (embedded PostgreSQL); `tests/integration/**` (18 real-PG tests). See "Phase 2 checkpoint" below. |
| 3 | Authentication, authorization and asset storage | `passed (partial)` — security review gate; live Supabase evidence deferred | `feat: Phase 3 auth, guards, guest tokens, storage` | `src/lib/supabase/{config,server,client,middleware}.ts`; `src/server/auth/{identity,require-admin,current-customer,errors}.ts`; `src/server/admin/{guards,bootstrap}.ts`; `src/server/customers/{lazy-upsert,normalize}.ts`; `src/server/orders/access-tokens.ts`; `src/server/catalog/product-images.ts`; `src/lib/{storage,rate-limit}.ts`; `src/schemas/auth.ts`; `supabase/policies/*.sql`; `docs/supabase-setup.md`; +20 integration tests. See "Phase 3 checkpoint" below. |
| 4 | Product administration and dual storefronts | `not-started` | — | — |
| 5 | Pricing, tax, inventory and checkout core | `not-started` | — | — |
| 6 | Durable event delivery and scheduled recovery | `not-started` | — | — |
| 7 | Razorpay and end-to-end prepaid/COD checkout | `not-started` | — | — |
| 8 | Shiprocket and shipping operations | `not-started` | — | — |
| 9 | Invoices, refunds and returns | `not-started` | — | — |
| 10 | Notifications and delivery observability | `not-started` | — | — |
| 11 | Complete the operator dashboard | `not-started` | — | — |
| 12 | Full-system verification and preview readiness | `not-started` | — | — |
| 13 | Operational handover and authorized production launch | `not-started` | — | — |

## Repository baseline (as inspected 2026-09-07)

- Fresh git repository at `~/Documents/PoojaEdit`, branch `main`.
- Phase 0 established `docs/` (two specs + working records). Phase 1 scaffolded the Next.js app.
- **No prior application code existed** — nothing to preserve or reuse; nothing to avoid duplicating.
- Local toolchain: Node v24.18.0, npm 11.16.0. Node 24 is **not** the target runtime — `.nvmrc`/`engines` pin Node 22 LTS to match Vercel. `npm install` prints one `EBADENGINE` warning locally as a result; this is expected and non-blocking.

## Phase 1 checkpoint — evidence (2026-09-07)

| Playbook §4 check | Result |
| --- | --- |
| Clean install | `rm package-lock.json && npm install` → 400 pkgs, **0 vulnerabilities** (postcss forced to 8.5.28 via `overrides`; see `decisions.md` D-13) |
| Lint | `npm run lint` (eslint flat config, `next/core-web-vitals` + `next/typescript`) — clean |
| Type check | `npm run typecheck` (`tsc --noEmit`, strict) — clean |
| Unit smoke test | `npm run test` (Vitest) — **19/19** across `money`, `app-env`, `env` guard, `/api/health` route |
| Production build | `npm run build` — success; 5 routes, middleware 34.6 kB, `/api/health` dynamic, catalog/home static |
| Missing required config → useful error | Demonstrated end-to-end: a build with `APP_ENV=production` and no DB url fails with the aggregated Zod message (`• DATABASE_URL: … required when APP_ENV=production`). Guard logic in `src/lib/env.ts`. |
| Browser bundles contain no secrets | `grep` of `.next/static` for every server secret var name and for `pino`/server-only marker → none present |
| Preview cannot resolve live credentials by fallback | `assertNoLiveCredentialsOutsideProduction()` in `src/lib/env.ts` rejects `rzp_live_*` / `SENTRY_ENVIRONMENT=production` outside production; unit-tested. No fallback source is read for any var. |
| E2E harness | `npm run test:e2e --project=chromium` — **4/4** (home has both catalogue entrances, primary nav reaches both catalogues, skip link is first focusable, `/api/health` 200) |
| CI | `.github/workflows/ci.yml` — `verify` job (install/lint/typecheck/test/build/`npm audit --audit-level=high`) + `e2e` job (Playwright chromium). Not yet run on a remote (no GitHub remote configured). |

**Covers:** part of **AC-17** (clean build + tests + lint/type). Migration and preview-deploy portions of AC-17 remain for Phases 2 and 12.

**Limitations / notes carried forward:**
- No GitHub remote yet — CI workflow is committed but unexecuted.
- Playwright `mobile` project defined but only `chromium` run locally; browsers download in CI.
- Sentry SDK not installed — `instrumentation.ts` has the hook point, DSN-guarded init lands with monitoring wiring.
- Catalog routes (`/the-pooja-edit`, `/thrift`) are "coming soon" placeholders — real listings are Phase 4.

## Phase 2 checkpoint — evidence (2026-09-07)

Local DB: **embedded PostgreSQL 17** via `embedded-postgres` (`npm run db:dev`) — real Postgres, no Docker, no account (decision D-17). Production stays Supabase.

| Playbook §5 check | Result |
| --- | --- |
| Prisma 7 CLI + runtime adapter configured | `prisma.config.ts` (env loaded via dotenv; `datasource.url` = `DIRECT_URL ?? DATABASE_URL`); `src/lib/db.ts` builds the client with `@prisma/adapter-pg` + `pg` pool (max 5, conservative timeouts), one instance per process. Prisma 7 removed schema `url` + `directUrl` — see D-18. |
| generate + validate client | `prisma validate` ✓ · `prisma generate` ✓ → `src/generated/prisma` (gitignored; regenerated by `prepare` hook + CI). |
| migrate an empty database | integration `global-setup` drops/creates a fresh DB and runs `prisma migrate deploy` (both migrations) before every suite run ✓ |
| migrate an existing fixture database | `prisma migrate deploy` against the seeded `poojaedit_dev` → "No pending migrations", `migrate status` clean ✓. First *additive* N→N+1-over-data migration is exercised at Phase 4's first schema extension (mechanism proven; no throwaway migration added during the review gate). |
| seed twice safely | `npm run db:seed` run twice → identical counts `{products:3, variants:5, orders:2, orderItems:3}` ✓ (all upsert / find-or-create) |
| Prisma Studio via the CLI connection | `prisma studio` boots, HTTP 200 ✓ |
| runtime concurrent reads/writes | `tests/integration/concurrency.itest.ts` — two+ independent Prisma clients (separate pools/connections) via `@prisma/adapter-pg` ✓ |
| reject invalid stock / duplicate identifiers | `tests/integration/schema.itest.ts` — `reservedQty>onHandQty`, negative on-hand, duplicate SKU, duplicate `(catalog,slug)` all rejected ✓ |
| inspect SQL | `prisma/migrations/20260907111110_init/migration.sql` (1211 lines) + `…_manual_constraints/migration.sql` (CHECKs, partial unique indexes, one-of-one trigger) reviewed ✓ |
| catalog/slug scope + nullable category uniqueness | same slug in two catalogs OK; dup `(catalog,slug)` rejected; two **global** category slugs rejected via partial unique index (`WHERE catalog IS NULL`); global + scoped same slug OK ✓ |
| real-PostgreSQL concurrency (AC-04 foundation) | two buyers race for the last one-of-one unit → **exactly one succeeds**; 5 buyers vs 3 available → exactly 3; failure on a later mixed-cart item rolls back the earlier reservation ✓ |

**Manual constraints migration (`manual_constraints`)** adds what Prisma can't express: non-negative money/stock + `reservedQty ≤ onHandQty` CHECKs; positive line/movement quantities; the **order totals identity** `total = subtotal − discount + shipping + codFee + tax` as a CHECK; two partial unique indexes for Category shared-slug uniqueness; a `BEFORE INSERT/UPDATE` trigger enforcing the **thrift one-of-one** on-hand ≤ 1 limit for every write path.

**Covers:** foundations of **AC-01** (catalog isolation), **AC-04/05** (stock invariants, concurrency), **AC-11** (paise totals reconcile, immutable-snapshot columns in place), **AC-17** (migrations + integration suite).

**Deferred to a Supabase project (Phase 3+), recorded as blocked-not-passed:**
- The **Supavisor transaction-pooler + Prisma 7 adapter under concurrency** proof (master §3) — needs the real hosted pooler; local embedded Postgres has no Supavisor. `src/lib/db.ts` is written for it (unnamed statements) but the proof itself is pending.
- RLS / grants / Storage policy versioning that targets Supabase's `auth` / `storage` schemas.
- N→N+1 additive migration over populated data (first real one in Phase 4).

## Phase 3 checkpoint — evidence (2026-09-07)  ·  security review gate

Structured so the Supabase-auth dependency is one seam (`src/server/auth/identity.ts` → `supabase.auth.getUser()`); everything downstream is pure DB logic tested against embedded PostgreSQL.

| Playbook §6 item | Done now (tested) | Deferred to a Supabase project |
| --- | --- | --- |
| Server identity verification | `getVerifiedIdentity()` calls `getUser()` (re-validates JWT), never `getSession()`; no-op + null when unconfigured | real JWT round-trip; altered/forged cookie rejection |
| Next.js 15 cookie refresh | `src/lib/supabase/middleware.ts` `updateSession()` wired into `src/middleware.ts`; no-op until configured | live cookie rotation |
| Lazy customer creation by auth id | `lazyUpsertCustomer()` — creates once, reuses, refreshes email, distinct per authUserId — **4 integration tests** | — |
| Active admin / role guards | `resolveAdmin` + `assertActiveAdmin` + `assertRole`; `requireAdmin()`/`requireOwner()` compose identity + guards; role from `AdminUser` only, never client metadata — **integration tests** for null/inactive/wrong-role/active | signed-in vs inactive-admin over real auth |
| Owner bootstrap (no public escalation) | `bootstrapOwner()` — requires secret `ADMIN_BOOTSTRAP_TOKEN` **and** zero-active-admins; refuses once one exists — **integration tests** | route wiring (with admin UI, Phase 11) |
| Account ownership checks | `assertOwnsOrder()` returns "not found" (not "forbidden") for another customer's or a guest order — **integration tests** | — |
| Guest order access-token service | `issueOrderAccessToken` (plaintext once, SHA-256 hash stored), `verifyOrderAccessToken` (generic not-found on wrong token/scope/order/expired/revoked), `revoke` — **6 integration tests**; never links by contact match | — |
| Signed admin uploads + metadata confirmation | `requestProductImageUpload` (active-admin gate, **server-derived** path per catalog) + `confirmProductImageUpload` (rejects mismatched path → no takeover; requires object present; re-validates type/size/dims) over a `StoragePort` — **5 integration tests** with a fake port | real Supabase Storage signed URL + object stat |
| Public product bucket / private document bucket | `supabase/policies/02_storage_buckets.sql` (public `product-images` read + active-admin write; private `documents`) | apply + test in the project |
| Lock down commerce Data API | `supabase/policies/01_lock_down_data_api.sql` — revoke from `anon`/`authenticated`/**`public`** (the `public` grant is the gotcha), `ENABLE` (not `FORCE`) RLS, no policies | apply + verify anon `select` denied |
| Malicious file types/paths | `assertValidImageUpload` (webp/jpeg/png only, size ≤ 8 MB, dims 400–6000) + server-derived path — **unit + integration tests** | — |
| Rate-limit abuse-prone endpoints | `InMemoryRateLimiter` (fixed window) — **unit tests**; distributed limiter is Phase 12 | — |
| Token redaction in logs | `src/lib/logger.ts` already redacts `token`/`*.token` | — |

**Covers:** foundations of **AC-03** (guest purchase without login; forged contact match can't claim orders — linking requires the token) and **AC-12** (authorization enforced in services, not routes; Storage/Data API lockdown SQL versioned).

**Unlock path:** follow `docs/supabase-setup.md` (~5 min), set the env vars, then the deferred cells above become a config + re-run exercise (the tests already exist; the identity seam swaps from "null" to a real user).

## Phase 0 checkpoint — self-assessment against playbook §3

| Check | Result |
| --- | --- |
| Every fixed technology accounted for | Yes — see `compatibility-plan.md` stack table |
| No stale Cloudinary / Auth.js / MongoDB decision retained | Confirmed — no prior code exists; `decisions.md` records Supabase Auth + Supabase Storage + PostgreSQL as the only identity/storage/DB choices |
| Existing work preserved | N/A — greenfield repo, nothing to preserve |
| Secrets absent from repo | Yes — no `.env*` committed (`.gitignore` blocks them); only `.env.example` with empty values |
| Live configuration blockers listed | Yes — see `integration-setup.md` and the "Blockers" section below |
| Any mandated version that cannot safely deploy | None. Next.js 15.5.x is Maintenance LTS and still security-patched; all other pins are current. One watch item (Next.js 16 is now Active LTS) is recorded in `decisions.md` as a future proposal, not a Phase 0 blocker |

## Blockers / information needed before later phases

None blocked Phases 1–2 (local embedded PostgreSQL, no account). **Phase 3 is the first that wants a Supabase project** (Auth + Storage). Recorded so they are not rediscovered late:

1. **Supabase project (dev)** — needed from Phase 3 for Auth + Storage, and to run the deferred Supavisor+Prisma concurrency proof. A local Supabase CLI stack (Docker) is an alternative but this machine has no Docker; a free hosted dev project is the likely path. Free-tier allowances / pause / backup entitlement verified against the live account when created. (D-open-3 resolved for Phase 2 = embedded Postgres; Phase 3 revisits.)
2. **Razorpay test account** — needed from Phase 7.
3. **Shiprocket account + confirmation of an available test/sandbox mode** — needed from Phase 8. AC-13 stays blocked until this is confirmed.
4. **Meta WhatsApp Cloud API + approved templates**, **Resend verified sender** — needed from Phase 10.
5. **Inngest account (dev)** — needed from Phase 6.
6. **Real business/tax configuration** — legal name, GSTIN, supplier state/address, HSN + rates, invoice series, contact details, policy text. Needed for live checkout/invoices (Phases 5, 9, 13). Development proceeds on clearly labelled fixtures until the owner confirms these.
7. **Deploy target** — Vercel project + isolated preview environment, needed from Phase 12.

## Update rules

- Update this file at every phase checkpoint: set the phase status, record the checkpoint commit, list tests actually run and their results, and name the exact next task.
- Never record "all tests pass" when required tests were skipped — record skipped provider tests as `blocked`.
