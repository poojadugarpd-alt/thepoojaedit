# Build Progress

Stable architecture: [01-master-specification.md](01-master-specification.md) · Execution control: [02-execution-playbook.md](02-execution-playbook.md)

Status vocabulary: `not-started` · `in-progress` · `blocked` · `passed`

## Current position

| Field | Value |
| --- | --- |
| Authorized phase range | Phases 0–5 |
| Current phase | Phase 5 — Pricing, tax, inventory and checkout core (**checkpoint ready**) |
| Phase 0–2 status | `passed` (2026-09-07); Phase 2 schema sign-off still open |
| Phase 3 status | `passed (partial)` — security review gate; live Supabase evidence deferred |
| Phase 4 status | `passed` (2026-09-07) — storefront/admin review gate |
| Phase 5 status | `passed` (2026-09-07) — **financial/inventory review gate**: all mandatory concurrency/rounding/idempotency tests green; no payment UI yet (Phase 7) |
| Last commit | _git log — `feat: Phase 5 (part 1)` + `feat: Phase 5 (part 2)`_ |
| Tests run | `npm run check` ✓ (lint/type/**unit 48**/build) · `npm run test:integration` ✓ **75/75** (real PostgreSQL, +10 inventory +9 checkout) · `npm run test:e2e --project=chromium` ✓ **9/9** |
| Next task | Phase 5 financial/inventory checkpoint review, then authorize Phase 6 (durable event delivery + scheduled recovery) |

## Phase ledger

| Phase | Title | Status | Commit | Evidence |
| --- | --- | --- | --- | --- |
| 0 | Inspect and freeze the implementation baseline | `passed` | `docs: Phase 0 baseline` | This file + `compatibility-plan.md`, `module-map.md`, `acceptance-evidence.md`, `integration-setup.md`, `operations-runbook.md`, `decisions.md`, `deferred-scope.md` |
| 1 | Application foundation and environment isolation | `passed` | `chore: Phase 1 application foundation` | Next.js 15.5.25 app; `src/lib/{app-env,env,public-env,logger,money}.ts`; domain folders `src/server/*`, `src/features/*`; `/api/health`; middleware; instrumentation; Vitest (19) + Playwright (4) harness; `.github/workflows/ci.yml`; `.env.example`. See "Phase 1 checkpoint" below. |
| 2 | Database, migrations, Prisma and business schema | `passed` (review gate) | `feat: Phase 2 database + Prisma 7 schema` | `prisma/schema.prisma` (42 models, master §5); `prisma/migrations/` (init + `manual_constraints`); `prisma.config.ts`; `src/lib/db.ts` (adapter-pg singleton); `prisma/seed.ts` (idempotent fixtures); `scripts/{pg,db-dev}.ts` (embedded PostgreSQL); `tests/integration/**` (18 real-PG tests). See "Phase 2 checkpoint" below. |
| 3 | Authentication, authorization and asset storage | `passed (partial)` — security review gate; live Supabase evidence deferred | `feat: Phase 3 auth, guards, guest tokens, storage` | `src/lib/supabase/{config,server,client,middleware}.ts`; `src/server/auth/*`; `src/server/admin/{guards,bootstrap}.ts`; `src/server/customers/*`; `src/server/orders/access-tokens.ts`; `src/server/catalog/product-images.ts`; `src/lib/{storage,rate-limit}.ts`; `src/schemas/auth.ts`; `supabase/policies/*.sql`; `docs/supabase-setup.md`; +20 integration tests. |
| 4 | Product administration and dual storefronts | `passed` (review gate) | `feat: Phase 4 (part 1)` + `feat: Phase 4 (part 2)` + `test: Phase 4 Playwright` | **Reads:** `src/server/catalog/{queries,public-shape,admin}.ts`; `/the-pooja-edit` + `/thrift` listings, `[slug]` PDPs, `collections/[slug]`, `/search`; `/api/catalog/[segment]/products`; `sitemap.ts` + `robots.ts`. **Cart:** `src/features/cart/*` (Zustand persist, mixed, per-item return note). **Admin:** `/admin` + `/admin/products` (+ `[id]`, `/new`) with `src/server/catalog/admin.ts` (validation + audit) + `src/app/admin/products/actions.ts` + `src/features/admin/action-form.tsx`; `DEV_ADMIN_AUTH` dev bypass. **Dev data:** `migration/scripts/import-to-dev-db.mjs` (116 products) + `/legacy-media` route. **Tests:** `catalog.itest.ts` (10) + `catalog-admin.itest.ts` (8) + `e2e/storefront.spec.ts` (4). See "Phase 4 progress" below. |
| 5 | Pricing, tax, inventory and checkout core | `passed` (review gate) | `feat: Phase 5 (part 1)` + `feat: Phase 5 (part 2)` | `src/server/tax/calculator.ts` (pure GST, integer paise, inclusive extraction); `src/server/inventory/{reservations,cod,errors}.ts` (atomic reserve-all, expire/release/convert, late-capture reacquire, COD alloc/cancel; ledger idempotency keys); `src/server/checkout/{quote,place-order}.ts` (server-authoritative quote + hash; idempotent checkout + snapshots + outbox in one tx); `src/server/orders/{state,lifecycle,order-number}.ts`; `src/server/shipping` (test adapter); `src/server/settings`; `/order/[orderNumber]` guest view. Tests: `calculator.test.ts`(8) + `state.test.ts`(6) unit; `inventory.itest.ts`(10) + `checkout.itest.ts`(9) integration. See "Phase 5 progress" below. |
| 6 | Durable event delivery and scheduled recovery | `passed` (review gate) | `feat: Phase 6 — durable event delivery & scheduled recovery` | `src/server/events/*` (emit/dispatcher/side-effects/operational-tasks/scheduled); `src/server/webhooks/inbox.ts`; `src/inngest/*` + `/api/inngest`. See "Phase 6 progress" below. |
| 7 | Razorpay and end-to-end prepaid/COD checkout | `passed (partial)` — live Razorpay test evidence deferred | `feat: Phase 7 (partial) — Razorpay checkout + prepaid/COD end-to-end` | `src/server/payments/*`; `/api/webhooks/razorpay`; `/checkout` + `src/features/checkout/*`; `reconcile-payments` cron. See "Phase 7 progress" below. |
| 8 | Shadowfax and shipping operations _(provider changed from Shiprocket — master v1.1 / D-59)_ | `passed (partial)` — live Shadowfax test evidence deferred | `feat: Phase 8 (partial) — Shadowfax shipping operations` | `src/server/shipping/{port,status,shadowfax,testing,service}.ts`; `src/server/inventory/restock.ts`; `/api/webhooks/shadowfax`; `/admin/shipments/[id]/label`; `reconcile-shipments` + `create-shipment-on-confirm` Inngest fns; order-page tracking block. See "Phase 8 progress" below. |
| 9 | Invoices, refunds and returns | `passed (partial)` — owner review of business/tax fields + invoice samples pending | `feat: Phase 9+10 — invoices, refunds/returns, notifications` | `src/lib/documents.ts`; `src/server/invoices/{numbering,snapshots,pdf,service}.ts` (+ `pdf-lib`); `src/server/refunds/service.ts`; `src/server/returns/service.ts`; `src/server/inventory/restock.ts` (Phase 8); `/order/[orderNumber]/invoice`; `generate-invoice` + `reconcile-refunds` Inngest fns. See "Phase 9 progress" below. |
| 10 | Notifications and delivery observability | `passed (partial)` — template/wording review + test-recipient evidence pending | `feat: Phase 9+10 — invoices, refunds/returns, notifications` | `src/server/notifications/{templates,transports,service,testing}.ts`; `/api/webhooks/whatsapp` + `/api/webhooks/resend`; `send-notifications` Inngest fn; seed `NotificationTemplate` rows. See "Phase 10 progress" below. |
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

## Phase 4 progress (2026-09-07) — checkpoint ready

**Done (part 1, committed `feat: Phase 4 (part 1) …`):**

| Playbook §7 item | State |
| --- | --- |
| Catalog scope applied to every query/collection | ✅ `src/server/catalog/queries.ts` — every query carries `catalog`; keyset cursor on `(publishedAt,id)` |
| Public homepage → two catalogue entrances | ✅ (from Phase 1, unchanged) |
| Separate listings + PDPs | ✅ `/the-pooja-edit`, `/thrift`, `…/[slug]` — grid, sort, "Load more" via `/api/catalog/[segment]/products` |
| Thrift-specific fields + one-of-one + SOLD-page behaviour | ✅ PDP thrift block (condition/measurements/flaws/fabric/fit); SOLD state = readable URL, disabled controls, alternatives; `OutOfStock` JSON-LD |
| Acquisition cost absent from public payloads | ✅ `public-shape.ts` strips it; integration-tested |
| Mixed persisted cart, catalog labels, per-item return policy | ✅ Zustand + persist; `/cart` groups by catalog; advisory prices/stock; **adding never reserves stock** |
| SEO — metadata, canonical, OG, Product structured data | ✅ per page; `sitemap.ts`/`robots.ts` still to add |
| Responsive / keyboard / no 360px overflow | ✅ 360px verified no horizontal overflow; keyboard focus styles throughout; deeper a11y pass pending |
| Legacy-content as the dev dataset | ✅ `migration/scripts/import-to-dev-db.mjs` → 116 products (27 THE_POOJA_EDIT + 89 THRIFT) in the dev DB as migration-draft; images via dev-only `/legacy-media` route |

**Done (part 2, commits `feat: Phase 4 (part 2)` + `test: Phase 4 Playwright`):**

| Playbook §7 / §10 item | State |
| --- | --- |
| Admin product/variant/category/collection CRUD | ✅ `src/server/catalog/admin.ts` — create/update product, publish/status, upsert variant, thrift details, categories, collections. UI: `/admin/products` (filter/search/paginate), `/admin/products/[id]` (all sections), `/admin/products/new` |
| Publication validation | ✅ `validateForPublication` — image + priced active variant; THRIFT also needs details + condition + ≥1 measurement; one-of-one on-hand ≤ 1. Shown as a checklist on the edit page; `publishProduct` refuses otherwise |
| Audited changes | ✅ every mutation writes `AdminActivityLog` (before/after/reason); browser-verified |
| Cross-catalogue collection membership rejected | ✅ `addProductToCollection` + integration test |
| Admin auth | `requireAdmin()` gates the admin layout; **`DEV_ADMIN_AUTH=1`** dev bypass (development + Supabase-unconfigured only, logged) so the UI is reviewable now — swaps to real Supabase auth with no code change |
| `/search` | ✅ title/brand/description, catalogue filter, `noindex` |
| Collection pages | ✅ `/…/collections/[slug]` both catalogues, `notFound()` when missing/inactive |
| `sitemap.ts` / `robots.ts` | ✅ published products + active collections + static; admin/account/cart/checkout/api/search/legacy-media disallowed |
| Playwright journeys | ✅ `e2e/storefront.spec.ts` (4) + `e2e/shell.spec.ts` (5) — guest browse, 360px no overflow, **mixed cart survives reload (AC-01)**, **sold thrift no buyable control (AC-02)**, skip-link focus |

**Covers:** **AC-01** (catalog isolation across queries + admin + mixed cart
survives reload), **AC-02** (thrift details visible, SOLD URLs survive &
unbuyable, `OutOfStock` JSON-LD), part of **AC-16** (mobile 360 no overflow,
keyboard focus, per-page SEO metadata + structured data, public-only caching).

**Residual (not blockers for the Phase 4 gate — carry into later phases):**
- **Signed image upload** in admin needs Supabase Storage (Phase 3 deferred).
  `src/server/catalog/product-images.ts` + a fake port are tested; the admin edit
  page shows existing (legacy) images + set-primary/delete, upload lands with
  the Supabase project.
- Category/collection management UIs are thin (domain layer + membership done;
  full CRUD screens can extend in Phase 11's dashboard).
- Deeper a11y sweep (axe run) + full error/retry/loading-state matrix — Phase 12.
- Price-sort keyset pagination (currently a bounded first page) — revisit at scale.

## Phase 5 progress (2026-09-07) — checkpoint ready

Financial/inventory core. **No payment UI** — Razorpay is Phase 7; a typed test
shipping adapter stands in until Phase 8 (`testAdapter: true` marker).

| Playbook §8 mandatory test | Result |
| --- | --- |
| ≥2 connections contend for one item → exactly one succeeds | ✅ `inventory.itest.ts` |
| failure on the final mixed-cart line rolls back all earlier allocations | ✅ `inventory.itest.ts` (0 reservations, 0 ledger rows after) |
| duplicate checkout returns one order | ✅ `checkout.itest.ts` (`alreadyExisted`, one Order) |
| mismatched idempotency payload rejected | ✅ `IdempotencyConflictError`, no 2nd order |
| expiry vs conversion races | ✅ exactly one of {expire, convert} takes effect; stock consistent; never negative |
| repeated release / cancel | ✅ second call is a no-op; COD cancel restores exactly once |
| negative quantities | ✅ `InsufficientStockError` |
| forged totals | ✅ `placeOrder` recomputes the quote server-side; a stale `clientQuoteHash` → `PriceChangedError` |
| inclusive tax extraction + component rounding | ✅ `calculator.test.ts` — `taxable + tax = gross`, CGST+SGST = line tax exactly, order identity in paise |
| price change | ✅ stale quote hash → reconfirm, no order |
| COD cancellation restores once | ✅ ledger `cod-cancel:<order>:<variant>` idempotency key |
| late capture after stock reallocated prevents fulfillment | ✅ `settleCapturedPayment` → `NEEDS_REVIEW` + `PAID` (payment never hidden as failed) |

**Also:** order/payment/fulfilment state machines + `deriveAggregatePaymentStatus`
(a failed later attempt never downgrades a captured payment); `OrderEvent` +
`DomainEvent` + `OutboxEvent` written in the placement transaction (dispatcher is
Phase 6); guest `/order/[orderNumber]?token=` view via the hashed access token.

**Covers:** foundations of **AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10,
AC-11**.

**Residual (carried forward):** checkout UI + `/checkout` page (Phase 5 built the
engine; the reviewed-quote → place-order UI flow lands with payments in Phase 7);
scheduled expiry sweep is a service (`expireReservations`) — the cron is Phase 6;
`SECOND_HAND_MARGIN` stays disabled; real GST rates/GSTIN owner-confirmed before
live checkout.

## Phase 6 progress (2026-09-07) — checkpoint ready

Durable event delivery & scheduled recovery. Transactional outbox → leased
dispatcher → idempotent consumers → operational tasks → authorised replay, plus
the recurring recovery jobs as real Inngest schedules (not request-scoped timers).

**New:** `src/server/events/{emit,dispatcher,side-effects,operational-tasks,scheduled}.ts`,
`src/server/webhooks/inbox.ts`, `src/inngest/{client,transport,functions}.ts`,
`src/app/api/inngest/route.ts`. `place-order.ts` + `orders/lifecycle.ts` refactored
onto `emitDomainEvent(tx, …)`. `inngest@3.54.2` + `.npmrc legacy-peer-deps=true`
(D-43). Decisions **D-43…D-50**.

| Playbook §9 check | Result |
| --- | --- |
| committed domain event survives a dispatcher outage | ✅ `events.itest.ts` — `PENDING` outbox row persists; claimable later, correct type |
| duplicate send does not duplicate local effects (crash after send, before mark → redelivery) | ✅ `events.itest.ts` — lease expires, event re-claimed, consumer re-run, `runOnce` dedups → effect counter stays 1, `SideEffectExecution` SUCCEEDED, outbox DISPATCHED |
| crash during consumer execution | ✅ `events.itest.ts` "FAILED effect can be retried" — RUNNING→FAILED row is re-run on next delivery, ends SUCCEEDED, attempts=2 |
| stale lease recovered; original owner cannot mark | ✅ `events.itest.ts` — fresh claim within lease gets nothing; after lease, worker B claims (attempts=2); `markDispatched` by A → false, by B → true |
| successful steps not needlessly replayed | ✅ `events.itest.ts` — 2nd `runOnce` on a SUCCEEDED key → `{ran:false, reason:"already_succeeded"}`, `run` called once |
| exhausted retries surface once | ✅ `events.itest.ts` — repeated failing dispatch (maxAttempts 2) → outbox `FAILED` + **exactly one** `OperationalTask` `outbox:<id>` |
| replay is authorised & audited | ✅ `events.itest.ts` — `replayOutboxEvent` → PENDING/attempts 0 + `AdminActivityLog{action:"outbox.replay", entityId}` + `outbox:<id>` task RESOLVED. `replayOutboxAsOwner` gates on `requireOwner()` |
| expired reservations released while storefront idle | ✅ `events.itest.ts` — `runReservationSweep` releases a TTL-expired reservation (reservedQty 2→0), `released: 1` |
| remote-unknown outcome (adapter fixture) | ✅ `events.itest.ts` — `FakeTransport` `throw-after-accept`: send throws after the remote accepted; next delivery re-runs the consumer, `runOnce` dedups (effect once), `providerRef` preserved |
| webhook inbox dedup + bad signature + persistence boundary | ✅ `events.itest.ts` — redelivered event → `isNew:false`, one row; `WebhookVerificationError` → nothing persisted (`count()===0`) |

**Suite:** `npm run check` ✅ (lint · typecheck · **48** unit · build — `/api/inngest`
in the route table). `npm run test:integration` ✅ **86/86** (10 files, `events.itest.ts`
**11** new). `npm run test:e2e` ✅ **18/18** (chromium + mobile).

**Covers:** **AC-07** (webhook/checkout dedup — outbox + webhook-inbox layer added on
the Phase 5 `CheckoutRequest` foundation) and **AC-10** (side-effect failure never
rolls back a committed order; leased recovery + audited replay). Both move to
`in-progress` with Phase 6 evidence; they reach `passed` when Razorpay (Phase 7)
and notifications (Phase 10) exercise the real consumers.

**Checkpoint doc:** `operations-runbook.md` §3 (schedule owner, intervals, lease/
retry/backoff, stale thresholds) and §4 (authorised replay + a symptom→action
manual-recovery table) filled.

**Residual (carried forward):** real Inngest project (dev) still to be created —
the endpoint + crons are wired and unit-proven, but no live scheduled run has
executed against a deployed project (blocker #5). Payment/shipment reconciliation
crons are stubbed behind `ReconcilePort` / `runReconciliation` and get real bodies
in Phases 7–8. `on-outbox-dispatched` currently just records the event — real
consumers (email/WhatsApp, invoice) attach in Phases 9–10.

## Phase 7 progress (2026-09-07) — PARTIAL pass (review gate)

Razorpay test-mode checkout + end-to-end prepaid/COD. Built as a full slice and
proven with a deterministic in-memory provider double; **live Razorpay test
evidence is deferred** until a test account exists (blocker #2). This mirrors the
Phase 3 pattern: the code path is real and exhaustively tested, the "claim live
integration success" step waits for credentials.

**New:**
- `src/server/payments/` — `port.ts` (provider-neutral `PaymentProvider`
  interface + normalised types + typed errors), `razorpay-crypto.ts` (pure HMAC
  verify + payload normalisation, unit-tested), `razorpay.ts` (`RazorpayProvider`
  — all network confined here), `cashfree.ts` (`CashfreeProvider` — every method
  throws `ProviderDisabledError`, proves the port is neutral), `testing.ts`
  (`FakeRazorpay extends RazorpayProvider`, overrides only the network methods so
  the real crypto runs), `service.ts` (orchestration: `createPaymentAttempt`,
  `verifyPrepaidCheckout`, `handleProviderWebhook`, `makePaymentReconcilePort`,
  `createOrderRefund`), `index.ts` (provider selection + prisma-bound wrappers).
- `src/app/api/webhooks/razorpay/route.ts` — raw-body sink, `runtime=nodejs`.
- `src/schemas/checkout.ts` + `src/lib/in-states.ts` — address/quote validation.
- `src/app/checkout/{page,actions}.tsx` + `src/features/checkout/{checkout-client,
  resume-payment,razorpay}.tsx` — real checkout UI (server-computed quote, method
  toggle, Razorpay Checkout handoff, COD path) replacing the Phase 4 placeholder.
- `src/app/order/[orderNumber]/page.tsx` — success banner + pending-payment
  recovery panel.
- `src/inngest/functions.ts` — `reconcile-payments` cron (`*/5`), no-ops without keys.
- `src/server/orders/timeline.ts` — shared `appendOrderTimeline` (place-order and
  lifecycle refactored onto it).

Decisions **D-51…D-58**.

| Playbook §10 check | Result |
| --- | --- |
| legitimate provider test payment | ◐ `payments.itest.ts` via `FakeRazorpay` (real HMAC) → order CONFIRMED/PAID, reservation converted, `order.payment_settled` emitted. **Live Razorpay test-mode run deferred** (blocker #2). |
| forged browser success | ✅ bad checkout signature → `PaymentVerificationError`, order stays PENDING_PAYMENT, reservation intact |
| invalid signature (webhook) | ✅ tampered `x-razorpay-signature` → 401, `WebhookEvent` **never persisted** |
| wrong order / amount / currency | ✅ valid signature + wrong amount or currency → `PaymentMismatchError`, order NEEDS_REVIEW, one `payment-review:<order>` task, no fulfilment |
| authorized but not captured | ✅ `authorized` payment → attempt AUTHORIZED, order stays PENDING_PAYMENT/UNPAID, not fulfilled |
| duplicate / stale events | ✅ duplicate `payment.captured` webhook (same event id) → one `WebhookEvent`, one settlement, stock reduced once; stale `payment.failed` after capture → order stays PAID/CONFIRMED (no downgrade) |
| failure after provider creation | ✅ `createOrder` throws after row claimed → retry reuses the **same** `PaymentAttempt` (one local row, one provider order) |
| payment captured after reservation expiry | ✅ webhook capture post-expiry with stock gone → NEEDS_REVIEW + PAID (never hidden as failed) + review task (Phase 5 late-capture logic through the webhook path) |
| duplicate captured attempts | ✅ second `payment.captured` on a settled order → recorded as a distinct CAPTURED attempt + `payment.excess_capture` timeline + review task; order not re-confirmed, stock not re-reduced |
| pending-payment UI / recovery | ✅ `/order/[orderNumber]` renders `ResumePayment` for a prepaid PENDING_PAYMENT order; `resumePaymentAction` (token-guarded) starts a fresh attempt. e2e covers the COD terminal state; prepaid modal needs keys. |
| COD never shown as prepaid | ✅ `createPaymentAttempt` refuses a COD order (`PaymentError`); COD stays PENDING_CONFIRMATION / COD_PENDING; `e2e/checkout.spec.ts` asserts the order page shows "COD PENDING" and never "PAID" |
| aggregate refund limit under concurrency | ✅ two concurrent `createOrderRefund` for the full amount → exactly one succeeds, the other `RefundLimitError` (order row `FOR UPDATE` serialises); a completed full refund → order REFUNDED |
| provider-neutral interface | ✅ `CashfreeProvider` implements the port, every op throws `ProviderDisabledError` — labelled disabled, not a fake |
| local deterministic fixtures | ✅ `razorpay-crypto.test.ts` (10) known-vector HMAC + normalisation; `payments.itest.ts` (17) end-to-end via `FakeRazorpay` |
| reconciliation | ✅ `makePaymentReconcilePort` — a missed capture webhook is caught by polling `fetchOrderPayments` and settled; wired as the `reconcile-payments` cron |

**Suite:** `npm run check` ✅ (lint · typecheck · **58** unit · build — `/api/webhooks/razorpay`, `/checkout`, `/order/[orderNumber]` in the route table). `npm run test:integration` ✅ **103/103** (11 files; `payments.itest.ts` **17** new). `npm run test:e2e` ✅ **22/22** (chromium + mobile; `checkout.spec.ts` **2** new).

**Covers (advanced, not yet `passed`):** **AC-03** (guest prepaid + COD checkout without login), **AC-06** (browser tampering fails; only verified captured payments confirm), **AC-07** (duplicate/stale webhooks & double checkout → no duplicates — webhook inbox + `SideEffectExecution` + `runOnce settle:<order>`), **AC-08** (late capture / unknown outcome reconciled), **AC-09** (COD distinct from prepaid at every step).

**Deferred to a live Razorpay test account (blocker #2):**
- A real test-mode payment through Razorpay Checkout (UPI/card), real signature.
- A real Razorpay webhook delivery with a genuine `X-Razorpay-Signature`.
- The prepaid path in the browser (the Checkout modal needs `NEXT_PUBLIC_RAZORPAY_KEY_ID`).
- AC-06/07/08/09 stay `in-progress` until this evidence exists; no live charge or
  refund without explicit authorisation (playbook Phase 7 checkpoint).

**Residual / carried forward:** admin refund WORKFLOW (authorisation UI, restock
decision, credit notes) is Phase 9 — Phase 7 built only the `createOrderRefund`
primitive + the aggregate-limit guard. Real GST rates/GSTIN still owner-confirmed
before live checkout. Notifications on `order.placed` / `payment.captured` are
Phase 10 (`on-outbox-dispatched` still only records).

## Phase 8 progress (2026-09-07) — PARTIAL pass (review gate)

Shipping operations. **Provider changed Shiprocket → Shadowfax** at the owner's
direction (architecture-gate, master bumped to **v1.1**, D-59). Built as a full
slice, proven with a deterministic in-memory `FakeShadowfax`; **live Shadowfax
test evidence is deferred** to a merchant account (blocker #3). Shadowfax is a
single last-mile carrier — one AWB, no courier selection — and its callback auth
is weak by design, so every tracking transition is re-verified against the
authenticated tracking API.

**New:**
- `src/server/shipping/port.ts` — `ShippingProvider` (extends the Phase 5
  quote-only `ShippingPort`): createShipment / fetchTracking / cancelShipment /
  fetchLabel / fetchCodRemittance / parseWebhook (+ typed errors).
- `status.ts` — `normalizeShadowfaxStatus` (unknown → null, not guessed),
  `shouldApplyTransition` / `canAdvanceFulfillment` (legal step OR forward-rank
  jump; never regress), `eventFingerprint`.
- `shadowfax.ts` — `ShadowfaxProvider`, all `fetch` confined; endpoint
  paths/fields follow the documented merchant API, flagged to confirm live.
- `testing.ts` — `FakeShadowfax` (idempotent create, timeouts before/after,
  out-of-order scans, NDR repeats, RTO, COD collected-vs-remitted).
- `service.ts` — `createShipmentForOrder` (claim local row → probe/adopt →
  create; `shipment-failure` task on error), `applyTrackingEvent` +
  `reconcileShipment` (fingerprint dedup, stale-guard, order mirror),
  `handleShadowfaxWebhook` (persist+dedupe → ignore body → API re-verify),
  `inspectRtoReturn` (authorised, audited, restock exactly once),
  `syncCodRemittance`, `getShipmentLabel`, `ensureShipmentForConfirmedOrder`.
- `src/server/inventory/restock.ts` — `restockUnits` (pre-checks ledger keys; a
  caught P2002 inside a Prisma interactive tx aborts the tx — D-64).
- `/api/webhooks/shadowfax` (raw body), `/admin/shipments/[id]/label`
  (`requireAdmin()`), order-page tracking block.
- `src/inngest/functions.ts` — `reconcile-shipments` (`*/10`) +
  `create-shipment-on-confirm` (consumes `order.payment_settled` /
  `order.cod_confirmed`, `runOnce`-guarded).
- Checkout quote now resolves its shipping provider via `getQuoteProvider()`
  (Shadowfax if configured, else `TestShippingAdapter`).

Decisions **D-59…D-66**. Master **v1.1** (§2, §3, §8, AC-13 + changelog);
playbook Phase 8 heading/prompt updated. No schema migration.

| Playbook §11 check | Result |
| --- | --- |
| non-serviceable postcode | ✅ `shipping.itest.ts` — `computeQuote` via `FakeShadowfax` for PIN `000000` → `QuoteError` |
| COD disallowed | ✅ COD quote for PIN `560100` → `QuoteError` |
| provider timeout BEFORE creation | ✅ claimed `Shipment` row (no `providerShipmentId`) + `shipment-failure` task; retry reuses the same row, one provider order, task resolved |
| provider timeout AFTER creation | ✅ retry probes `fetchTracking(merchantReference)` and **adopts** the provider's shipment — one `Shipment`, one provider record |
| repeated shipment request | ✅ second call → `{created:false}`, same row; one `Shipment`, one `ShipmentItem` set |
| authenticated / invalid callback | ✅ configured static token: missing → 401, nothing persisted; present → 200; identical redelivery → deduped (one `WebhookEvent`); status advanced via **API re-read**, not the body |
| out-of-order tracking | ✅ a late `IN_TRANSIT` scan after `OUT_FOR_DELIVERY` is recorded for audit but does not regress `statusNormalized` |
| NDR repeated events | ✅ two NDR scans → **one** `ndr:<shipmentId>` task (reopened), reason `attempt 2`; both `ShipmentEvent` rows kept |
| RTO-in-transit does not restock | ✅ `RTO_INITIATED` → shipment `RTO_IN_TRANSIT`, **zero** `RTO_RESTOCK` ledger rows, on-hand unchanged |
| inspected RTO restocks once | ✅ `RTO_DELIVERED` → `RTO_RECEIVED` + `rto-inspection` task; `inspectRtoReturn(RESTOCK)` → on-hand +qty, one `RTO_RESTOCK` row, `AdminActivityLog` + timeline, task resolved; **repeat inspection restocks nothing** |
| private label access | ✅ `/admin/shipments/[id]/label` calls `requireAdmin()` (401/403 mapped); `getShipmentLabel` returns bytes with an AWB, throws before one |
| COD collection differs from remittance | ✅ delivery leaves `COD_PENDING`; `simulateCodCollected` + `syncCodRemittance` → `CodRemittance.COLLECTED` + order `COD_COLLECTED`; `simulateCodRemitted` → `REMITTED` + UTR, order still `COD_COLLECTED`; distinct `collectedAt` / `remittedAt`; short collection → `DISPUTED` + `cod-remittance` `PAYMENT_REVIEW` task |

**Suite:** `npm run check` ✅ (lint · typecheck · **69** unit incl. `shipping/status.test.ts` (13) · build — `/api/webhooks/shadowfax`, `/admin/shipments/[id]/label` in the route table). `npm run test:integration` ✅ **118/118** (12 files; `shipping.itest.ts` **15** new). `npm run test:e2e` ✅ **22/22**.

**Covers (advanced, not yet `passed`):** **AC-09** (COD allocation / confirmation / cancellation / collection / RTO / remittance all distinct + auditable) and **AC-13** (creation, tracking, NDR/RTO, retry handling) — via `FakeShadowfax`.

**Deferred to a live Shadowfax merchant account (blocker #3):**
- Real serviceability + rate lookups; a real shipment create with a real AWB.
- The account's **actual** callback authentication mechanism + a real callback.
- A real label PDF; real COD remittance report reconciliation.
- Endpoint paths / payload field names in `shadowfax.ts` confirmed against the
  live API. AC-13 stays `blocked` until a provider-supported test arrangement is
  confirmed (playbook Phase 8 checkpoint — "do not assume a sandbox exists").

**Residual / carried forward:** shipment admin UI beyond the label route is
Phase 11; `Shipment.provider` DB default is still literally `"shiprocket"` (a
harmless default — every write passes `"shadowfax"`); pickup address is a
labelled `shipping.rules` fixture until the owner confirms it; single-shipment
model (schema is split-ready).

## Phase 9 progress (2026-09-08) — PARTIAL pass (review gate)

Invoices, refunds workflow, returns/inspection. No schema migration (Phase 2
`Invoice`/`InvoiceSequence`/`CreditNote`/`ReturnRequest`/`ReturnItem` already fit).
Added **`pdf-lib`** (pure JS, MIT, `npm audit` 0).

**New:**
- `src/lib/documents.ts` — private `DocumentStore` (Supabase `documents` bucket
  when configured, else a git-ignored `.storage/` dir; `InMemoryDocumentStore`
  for tests). Distinct from the browser-upload `StoragePort`.
- `src/server/invoices/numbering.ts` — `financialYearFor` (India Apr–Mar) +
  `allocateInvoiceNumber` (atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`).
- `snapshots.ts` — immutable legal / address / line / tax snapshots (by value
  from the already-immutable `OrderItem`/`OrderAddress`).
- `pdf.ts` — one-page GST invoice via `pdf-lib`; WinAnsi-safe (`Rs` not `₹`,
  non-Latin stripped); DRAFT watermark for fixture / unconfirmed-business.
- `service.ts` — `createInvoiceForOrder` (idempotent on `@@unique([orderId])`,
  concurrent losers roll back their sequence increment → no gap),
  `generateInvoicePdf` (idempotent, `INVOICE_FAILURE` task on failure, never
  touches order/payment), `issueCreditNote` (per-`(invoiceId, refundId)`,
  number under the invoice row lock).
- `src/server/refunds/service.ts` — `requestRefund` (over the Phase 7
  `createOrderRefund` aggregate-limit primitive; on COMPLETED → `refund.completed`
  event + credit note), `makeRefundReconcilePort` (`fetchRefund` for missed
  completions).
- `src/server/returns/service.ts` — `createReturnRequest` (delivered-only,
  final-sale rejected, per-line remaining-qty check), `decideReturn` /
  `markReturnReceived` / `finalizeReturnInspection` (`RETURN_TRANSITIONS`,
  audited), `inspectReturnItem` (`RESTOCK` → `restockUnits` key
  `return-restock:<returnItemId>`, exactly once), `resolveReturn` (`REFUND` →
  refund workflow for the line value; **never** restocks).
- `/order/[orderNumber]/invoice` — PDF download, owner or `ORDER_VIEW` token,
  generic 404 otherwise.
- Inngest: `generate-invoice` (consumes `order.payment_settled`/`order.cod_confirmed`,
  `runOnce`), `reconcile-refunds` (`*/15`, no-op without Razorpay).

Decisions **D-67…D-72**.

| Playbook §12 check | Result |
| --- | --- |
| simultaneous invoice creation → one identity | ✅ `invoices.itest.ts` — 3 concurrent `createInvoiceForOrder` → one `Invoice`, one number |
| retries reuse it | ✅ a 4th call returns the same id + number |
| financial-year boundary | ✅ `financialYearFor` unit + integration (confirmedAt 2026-03-15 → FY 2025-26) |
| exact tax totals | ✅ `taxSnapshot` CGST+SGST+IGST = order tax; invoice total = order total; `breakdownByRate` sums |
| product/tax edits do not alter old invoices | ✅ edit variant price + product title after issue → `lineSnapshot` byte-identical |
| unauthorized PDF denied | ✅ `/order/[orderNumber]/invoice` needs owner or `ORDER_VIEW` token → 404 |
| PDF job idempotent / repeatable | ✅ `generateInvoicePdf` twice → one object, same key; `%PDF-` header; render failure → `INVOICE_FAILURE` task, order untouched |
| partial refunds sum correctly | ✅ `returns.itest.ts` — two 40% refunds COMPLETED; a third → `RefundLimitError`; order `PARTIALLY_REFUNDED` |
| concurrent over-refunds blocked | ✅ Phase 7 `payments.itest.ts` (`FOR UPDATE` on the order) + `returns.itest.ts` |
| unknown refund outcome reconciled | ✅ `makeRefundReconcilePort` drives a stuck PROCESSING refund to COMPLETED from `fetchRefund` |
| duplicate inspection cannot restock twice | ✅ 2nd `inspectReturnItem(RESTOCK)` on the same line → `restocked:false`, on-hand unchanged, one `RETURN_RESTOCK` row |
| credit note on refund | ✅ completed refund → one `CreditNote` (`reason REFUND`), invoice byte-identical; idempotent per refund |
| render representative new/thrift/mixed PDFs | ✅ `pdf.test.ts` renders new-apparel (CGST/SGST) / thrift one-of-one / mixed inter-state (IGST, COD) / DRAFT fixture — valid PDFs, sent to the user for visual review |

## Phase 10 progress (2026-09-08) — PARTIAL pass (review gate)

Notifications: versioned template registry, channel eligibility/consent, durable
delivery identities, verified callbacks, per-delivery dedup, audited replay. SMS
absent by design. Zero new deps (Resend/Meta via `fetch`).

**New:**
- `src/server/notifications/templates.ts` — code registry (source of truth for
  existence / version / Zod variable schema / rendering); a `NotificationTemplate`
  DB row is an optional per-store DISABLE / provider-template-id override. Copy is
  distinct per lifecycle event; **COD confirmation never says "paid" / "payment
  successful"**.
- `transports.ts` — `EmailTransport` (Resend REST), `WhatsAppTransport` (Meta
  Graph REST), `InAppTransport` (`AdminNotification`); noop when unconfigured.
- `service.ts` — `sendNotification` (eligibility → `deliveryKey` dedup on
  `NotificationDelivery @@unique` → render → send → SENT/FAILED + task; skips are
  never throws), `notifyForDomainEvent` (the master's event→channel matrix, one
  failure never aborts the rest), `retryNotification` (audited), `applyDeliveryCallback`
  (forward-only status; a stale callback cannot undo DELIVERED/READ).
- `testing.ts` — `FakeEmailTransport` / `FakeWhatsAppTransport` (record-only, `failNext`).
- `/api/webhooks/whatsapp` — GET verify handshake + POST `X-Hub-Signature-256`
  HMAC (`META_APP_SECRET`) → status callbacks.
- `/api/webhooks/resend` — POST Svix signature (`RESEND_WEBHOOK_SECRET`, `whsec_`
  base64 key over `id.timestamp.body`) → status callbacks.
- Inngest `send-notifications` (consumes `poojaedit/outbox.dispatched`,
  independent of the other consumers).
- `prisma/seed.ts` — `seedNotificationTemplates()` (11 templates).

Decisions **D-73…D-76**.

| Playbook §13 check | Result |
| --- | --- |
| missing email/consent does not break checkout | ✅ `notifications.itest.ts` — no email / no `transactionalConsent` / disabled template → `skipped`, no throw, no delivery row |
| provider outage preserves paid order | ✅ transport `failNext` → `NotificationDelivery` FAILED + `notification:<id>` task; `notifyForDomainEvent` still resolves; order untouched |
| duplicate event does not duplicate logical delivery | ✅ same `deliveryKey` → 2nd send `deduped`, one row; two `order.payment_settled` events (different `domainEventId`, same transition seed) → 3 deliveries total, not 6 |
| stale callback cannot undo delivered state | ✅ DELIVERED then a `sent` callback → stays DELIVERED (`applied:false`) |
| template variables validated | ✅ bad/missing vars → `TemplateVariableError`; unsupported channel rejected |
| failures observable | ✅ FAILED row + `lastError` + `JOB_FAILURE` task |
| replay safe | ✅ `retryNotification` on a FAILED row → SENT, one `AdminActivityLog{action:"notification.retry"}`, reuses the row (no dup) |
| API acceptance ≠ delivery | ✅ transport returns id → status `SENT`; only a delivery callback → `DELIVERED` |
| no COD "payment successful" message | ✅ `render.test.ts` + `notifications.itest.ts` — `order_confirmation_cod` has no `paid`/`payment successful`, says "Cash on Delivery" |
| distinct wording per event | ✅ confirmation / shipping / delivery / cancellation / refund all separate templates + subjects |
| test email rendering / approved WhatsApp template | ◐ rendered + asserted via fakes; **live Resend + approved Meta template deferred** (blocker #4) |

**Suite (Phases 9+10):** `npm run check` ✅ (lint · typecheck · **85** unit incl.
`invoices/numbering` (5) + `invoices/pdf` (5) + `notifications/render` (8) · build
— `/order/[orderNumber]/invoice`, `/api/webhooks/whatsapp`, `/api/webhooks/resend`
in the route table). `npm run test:integration` ✅ **144/144** (15 files;
`invoices.itest.ts` **7**, `returns.itest.ts` **7**, `notifications.itest.ts` **12**
new). `npm run test:e2e` ✅ **22/22**. `npm audit` ✅ 0.

**Covers (advanced):** **AC-05** (return/RTO restock exactly once, never from
refund), **AC-07** (invoice/refund/notification dedup), **AC-10** (doc/notification
failure never rolls back a paid order; audited replay), **AC-11** (immutable
FY-numbered GST invoice snapshots), **AC-12** (private PDF, authorized download),
**AC-14** (template + delivery paths with consent + missing-channel handling).
AC-11/12/14 stay `in-progress` pending owner review + live provider evidence.

**Deferred:**
- **Phase 9 checkpoint:** owner reviews business/tax/invoice fields + the sample
  PDFs before any live issuance. `business.profile` is a labelled fixture; the
  DRAFT watermark stays until real GSTIN/rates are confirmed.
- **Phase 10 checkpoint (blocker #4):** a real Resend send to a test recipient +
  an **approved** Meta WhatsApp template delivered to a test number. Resend Svix
  secret + Meta app secret / verify token / phone-number id needed. Without them
  the transports are noop and email/WhatsApp deliveries record as skipped/failed.
- Supabase Storage for invoice PDFs — currently the local `.storage/` dir
  (Phase 3 deferred).

## Blockers / information needed before later phases

None blocked Phases 1–2 (local embedded PostgreSQL, no account). **Phase 3 is the first that wants a Supabase project** (Auth + Storage). Recorded so they are not rediscovered late:

1. **Supabase project (dev)** — needed from Phase 3 for Auth + Storage, and to run the deferred Supavisor+Prisma concurrency proof. A local Supabase CLI stack (Docker) is an alternative but this machine has no Docker; a free hosted dev project is the likely path. Free-tier allowances / pause / backup entitlement verified against the live account when created. (D-open-3 resolved for Phase 2 = embedded Postgres; Phase 3 revisits.)
2. **Razorpay test account** — **now the active gate for Phase 7's full pass.** Code slice complete + tested; needs test key id/secret + webhook secret, then a real test-mode payment and a real signed webhook to move AC-06/07/08/09 to `passed`. Steps in `docs/integration-setup.md`. No live charge/refund without explicit authorisation.
3. **Shadowfax merchant account + confirmation of a provider-supported test arrangement** — **now the active gate for Phase 8's full pass.** Code slice complete + tested against `FakeShadowfax`; needs `SHADOWFAX_API_TOKEN` / `SHADOWFAX_CLIENT_ID` (+ `SHADOWFAX_WEBHOOK_TOKEN` if the account supports one), the real endpoint paths/fields confirmed, and a real shipment + callback + label + COD-remittance exercised. AC-13 stays `blocked` until a sandbox or authorised controlled test is confirmed. _(Provider changed from Shiprocket at the owner's direction — master v1.1 / D-59.)_
4. **Meta WhatsApp Cloud API + approved templates**, **Resend verified sender + Svix webhook secret** — **now the active gate for Phase 10's full pass.** Code slice complete + tested against fakes; needs `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_VERIFY_TOKEN`/`META_APP_SECRET` + `RESEND_API_KEY`/`EMAIL_FROM`/`RESEND_WEBHOOK_SECRET`, an approved WhatsApp template per key, then a real test-recipient send each. AC-14 stays `in-progress` until then. Template wording also needs an owner pass.
5. **Inngest account (dev)** — needed from Phase 6.
6. **Real business/tax configuration** — legal name, GSTIN, supplier state/address, HSN + rates, invoice series, contact details, policy text. Needed for live checkout/invoices (Phases 5, 9, 13). Development proceeds on clearly labelled fixtures until the owner confirms these.
7. **Deploy target** — Vercel project + isolated preview environment, needed from Phase 12.

## Update rules

- Update this file at every phase checkpoint: set the phase status, record the checkpoint commit, list tests actually run and their results, and name the exact next task.
- Never record "all tests pass" when required tests were skipped — record skipped provider tests as `blocked`.
