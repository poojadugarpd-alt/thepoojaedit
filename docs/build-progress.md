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
