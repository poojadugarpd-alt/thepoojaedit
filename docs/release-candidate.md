# Release Candidate — evidence review & blocker list

Produced at the Phase 12 checkpoint (2026-09-08). This is **not** a production-ready
declaration — required provider configuration, owner sign-off and a preview deploy
are outstanding (see blockers). It is the release candidate against which those are
closed in Phase 13.

Commit: see `git log` (`feat: Phase 12 — full-system verification`).

---

## 1. Automated suite (all green)

`npm run verify` runs the whole thing:

| Stage | Result |
| --- | --- |
| `npm run check` — lint · `tsc --noEmit` · **85** unit (`vitest run`) · `next build` | ✅ |
| `npm run test:integration` — **159** tests, real PostgreSQL 17, `fileParallelism:false` | ✅ |
| `npm run test:e2e` — **54** Playwright tests (chromium + Pixel-7 mobile) | ✅ |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilities |

Coverage highlights (the master's minimum automated suite):

- **Pricing / state transitions** — `src/server/tax/calculator.test.ts`, `orders/state.test.ts`, `shipping/status.test.ts`, `payments/razorpay-crypto.test.ts`, `invoices/numbering.test.ts` + `pdf.test.ts`, `notifications/render.test.ts`.
- **PostgreSQL migrations / constraints / races** — `schema.itest.ts`, `concurrency.itest.ts`, `inventory.itest.ts` (last-unit race → exactly one winner; mixed-cart rollback), `checkout.itest.ts` (idempotent checkout), `events.itest.ts` (lease dispatch, stale-lease recovery, exhaustion).
- **Browser journeys** — `e2e/storefront.spec.ts` (guest mixed cart survives reload, sold thrift, 360px no-overflow, skip-link), `e2e/checkout.spec.ts` (guest COD, never shown as paid), `e2e/admin.spec.ts` (operator shell + order detail + filtered list), `e2e/keyboard-checkout.spec.ts` (Tab-only checkout).
- **Return before webhook AND webhook before return** — `verification.itest.ts`: both orderings settle stock exactly once (`runOnce("settle:<order>")`), one `order.payment_settled` event either way.
- **Private caching / direct API authorization** — `e2e/headers-seo.spec.ts` (catalog API `s-maxage`, no `private`/`no-store`; `/cart` `/checkout` `/admin` `noindex`; robots.txt gates admin/cart/checkout/account); `verification.itest.ts` (invoice route: 404 without token, 200 PDF `private, no-store` with `ORDER_VIEW` token; customer sees only their own order).
- **Accessibility** — `e2e/a11y.spec.ts`: axe-core WCAG 2.1 A/AA clean on home / both listings / a PDP / cart / checkout; no critical/serious on the four core admin screens.
- **Outbox recovery / idle scheduler** — `events.itest.ts` (committed event survives a dispatcher outage; reservation sweep releases while the storefront is idle).

## 2. Migrations

Three migrations, all forward-only and additive over the approved Phase 2 schema:

| Migration | What | Rehearsed |
| --- | --- | --- |
| `20260907111110_init` | full 42-model schema | `prisma migrate deploy` on an empty DB (integration `global-setup`, every run) |
| `20260907111144_manual_constraints` | CHECKs, partial unique indexes, thrift one-of-one trigger, order-totals identity | same |
| `20260908041119_phase12_hot_path_indexes` | `CREATE INDEX` on `InventoryTransaction(type,createdAt)` + `OperationalTask(status,type)` — no data change, no table rewrite | applied over the **seeded dev DB with data** via `prisma migrate dev`; `prisma migrate status` clean; also picked up by the fresh-DB `migrate deploy` path |

N→N+1 additive-migration-over-data: ✅ demonstrated. Production migration policy (expand → backfill → validate → switch → later contract; never `reset`/`db push`/edit-applied) is in `operations-runbook.md` §2.

## 3. Performance — lab notes (no field data yet)

Field targets are **LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1**. There is no traffic, so
these are recorded as intentions with repeatable lab observations, not measured field
results.

- **Bundle** — `next build` route table: First Load JS **103 kB shared**, per-route
  **103–115 kB**. Storefront pages are RSC with small client islands (cart store,
  add-to-cart, checkout form); admin pages are RSC + `force-dynamic` with a tiny
  `Poll` island. No client-side data fetching on first paint.
- **Images** — `next/image` with a bounded `remotePatterns` allow-list (3 legacy
  CDN hosts, dev only; production is Supabase Storage). Legacy dev imagery is served
  through `/legacy-media` in dev only. Real image weights + `sizes` tuning are a
  launch task once production assets exist.
- **Catalog pagination** — keyset (`/api/catalog/[segment]/products`, bounded first
  page); admin `listOrders` keyset on `(createdAt,id)`. No `OFFSET` scans.
- **DB connections** — `src/lib/db.ts` pool `max: 5` per process, 10 s idle/connect
  timeouts, unnamed statements (Supavisor transaction-pooler compatible). One client
  per process, never per-request. The Supavisor pooler ceiling and Free-tier limits
  are verified against the live account in Phase 13.
- **CLS** — image containers use fixed aspect ratios; no late-injected banners on the
  storefront. Not yet measured in a lab run with throttling — a Phase 13 task.

No paid cache service was added; hosting is unchanged (Vercel + Supabase, per master §2).

## 4. Security / data-integrity review

No unresolved **critical security, overselling, money, migration or data-loss** defect:

- **Overselling** — atomic conditional `reserveAll`; conversion decrements on-hand +
  reserved together; late capture with no stock → `NEEDS_REVIEW` + `PAID`, fulfilment
  blocked, never silently fulfilled (`checkout.itest.ts`, `payments.itest.ts`).
- **Money** — integer paise throughout; tax INCLUSIVE extraction (no double tax);
  order-totals identity is a DB CHECK; refund aggregate limit under `SELECT … FOR
  UPDATE` counts pending + completed; invoice numbers are atomic + gap-free on a lost
  race; a completed refund never restocks.
- **Auth** — every `/admin` action calls `requireAdmin()`; ownership guards return a
  generic not-found; guest access is an expiring hashed scoped token; webhook routes
  verify raw-body signatures (Razorpay HMAC, Meta HMAC, Resend Svix) and reject
  unsigned; Shadowfax's weak callback auth is backed by API re-verification.
- **Secrets / PII** — Pino redaction configured; `env.ts` rejects obviously-live
  credentials outside production; no secret is ever sent to the browser or written to
  `StoreSettings`; credential-health screen shows presence, never values.
- **Idempotency** — checkout key, `WebhookEvent(provider,externalEventId)`,
  `SideEffectExecution.executionKey`, `NotificationDelivery.deliveryKey`,
  `InventoryTransaction.idempotencyKey`, `Refund.operationKey`, `PaymentAttempt.operationKey`.

## 5. Blocker list (ordered) — must close before "production ready"

| # | Blocker | Gates | Owner action |
| --- | --- | --- | --- |
| 1 | **Supabase — ✅ separate production project live** (D-85, 2026-09-09; D-115, 2026-09-14) | New project `poojaedit-prod` (ref `fizwboogbaeximscatsk`, ap-south-1 Mumbai, Free) created and cut over to. Full data migration (44 tables, every row, exhaustive per-table count verification) + Storage migration (all 3 buckets, all objects, verified by recursive count) from the old `poojaedit` project; `01`/`02`/`03` security policies applied; admin auth linked via `supabase.auth.admin.createUser` (owner sets a real password via "Forgot password" on next login — Auth itself can't be copied cross-project). Vercel Production env vars (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) switched to the new project; Preview/Development deliberately left on the old project, which is now dev/staging. Cutover verified live in production three ways: homepage/PDP/sitemap all render correctly post-redeploy; a temporary marker written to the *old* project's data did **not** appear on the live site, proving Production now reads the new database; recursive Storage object counts matched on both projects before the switch. **Still open:** real signed-URL upload + private-bucket download checks against the new project (AC-12 remainder, unaffected by the migration itself); AC-03/AC-11 live auth (auth UI not built — `/account` hidden, guest checkout only); Supavisor+Prisma concurrency proof; Free-tier pause/backup entitlement check for the new project. |
| 2 | **Razorpay test-mode account — ✅ DONE** (D-87, 2026-09-11) | AC-06 / AC-08 live evidence; the prepaid browser path | test keys + webhook secret live in Vercel; `/api/webhooks/razorpay` registered (5 events, secret matches); real test-card payment on order `PE-260911-Z8Z4MN` settled `PAID`/`CONFIRMED` via the live webhook; test order cancelled afterward |
| 3 | **Shadowfax merchant account + supported test arrangement — ✅ live staging shipment verified** (D-88, D-89, 2026-09-11) | **AC-13**, AC-09 live remittance | `shadowfax.ts` rewritten against the account's real live API docs and proven live: order `PE-260911-BWFDHH` → admin "Create shipment" → real AWB `SF1776105686TPJ` returned by Shadowfax's staging API; "Reconcile tracking" pulled a real `new` tracking event back; zero error-level logs during the run. **Still open:** a real push-callback received (webhook registered — `FWD Marketplace`, staging + production — but not yet triggered by a real status change); label download and COD remittance have no documented self-serve API (`fetchLabel`/`fetchCodRemittance` say so explicitly) — resolve with Shadowfax's account manager before launch; production API token (staging token is wired) |
| 4 | **Resend — ✅ domain verified 2026-09-13; WhatsApp deferred by owner, cost** | AC-14 (email leg only) | Account created; sending domain `mail.thepoojaedit.in` added in Resend (subdomain — independent of the D-94/#7 root-domain cutover); `RESEND_API_KEY` + `EMAIL_FROM` wired into Vercel (all environments). D-95's GoDaddy account mismatch resolved, all 3 DNS records confirmed live via `dig` (D-98). `resend.com/domains` now shows `mail.thepoojaedit.in` as **Verified** — the transient dashboard hang noted in D-98 resolved on its own, no action was needed. **Still to do:** send a real test email to confirm live sending end to end (an outward-facing send, needs the owner's go-ahead) → (at the domain cutover) register the webhook + set `RESEND_WEBHOOK_SECRET`. **Meta WhatsApp is out of scope for launch** — approved templates + per-conversation pricing aren't worth it pre-revenue; the notification layer already no-ops a channel with no configured provider (D-75), so this doesn't block anything else. Revisit post-launch. |
| 5 | **Owner-confirmed business / tax / invoice configuration** | AC-11 (DRAFT watermark stays until then), live checkout/invoices | legal name, GSTIN, supplier state/address, HSN + GST rates per tax class, inclusive/exclusive policy, invoice series + issuance timing, COD/shipping rules, policy text; review the sample invoice PDFs |
| 6 | **Inngest project — ✅ live 2026-09-11 (D-97)** | the recurring schedules actually firing | Inngest app `poojaedit` is **Active with all 10 functions registered** against the stable alias `https://thepoojaedit.vercel.app/api/inngest`, correct triggers/schedules confirmed on the Functions page; a backlog of real outbox events queued while unsynced started draining immediately. D-94's diagnosis (needs the domain cutover) was wrong — the actual blocker was `sendNotifications`' `concurrency: 8` exceeding the free plan's limit of 5, fixed in D-97. **Operational note going forward:** Vercel's automatic post-deploy sync still targets the protected per-deployment URL and will keep failing; after any deploy that changes a function's config, run `curl -X PUT https://thepoojaedit.vercel.app/api/inngest` to re-sync against the stable alias (until the domain cutover). **Still open:** watch for a real cron firing (e.g. `dispatch-outbox`, every minute) to confirm end-to-end, not just registration. |
| 7 | **Vercel project + isolated preview environment — ◐ prod deploy live, custom domain not yet cut over** | AC-17 (isolated preview deploy), AC-18 drills | Vercel project exists (`thepoojaedit`), production deployments are live and building green. **`thepoojaedit.in` currently still serves the owner's existing, real Shopify store** (`CNAME → shops.myshopify.com`) — intentional, confirmed with the owner 2026-09-11: the domain stays on Shopify until this build is ready, then gets repointed as the go-live cutover step. Until that DNS change, the Vercel app is only reachable at its (Vercel-Authentication-protected) `*.vercel.app` URLs — gates blocker 6 above. **Checked 2026-09-13 (read-only):** Function Region is `iad1` (US East) as intended — confirms the "stay on the default US region for now" constraint held, nothing drifted to a paid region. Preview vs Production already get separate env-var scopes by default on the Hobby plan (Vercel's own "Environments" feature — custom named environments beyond the default three — is Pro-only, $50/5, and out of scope per the free-plan constraint; the default Preview/Production isolation already satisfies AC-17's intent without it). **Node.js Version — ✅ fixed 2026-09-13:** was drifted to 24.x; owner confirmed pinning to the 22.x this codebase has always assumed (`package.json` engines, `.nvmrc`, this doc), changed in Project Settings and redeployed. **`NEXT_PUBLIC_SITE_URL` — ✅ fixed 2026-09-13 (D-111):** was never set on Production at all, silently falling back to `localhost:3000` in every built page (sitemap, canonical/OG tags, notification links) — set to `https://thepoojaedit.vercel.app` (Production-scoped Config var) and redeployed; needs updating again at the `thepoojaedit.in` cutover. **Migrations on deploy — ✅ fixed 2026-09-13 (D-112):** the gap that caused D-111's outage (a pushed migration and its live-database deploy were two separate manual steps) is closed — `package.json`'s new `vercel-build` script now runs `prisma migrate deploy` automatically, but only when `VERCEL_ENV=production` (Preview still shares Production's database until blocker #2 lands, so an unreviewed branch's migration must not auto-apply the moment its preview builds). Verified locally end-to-end (skip path + apply-and-build path); not yet exercised on a real Vercel deploy with an actually-pending migration. |
| 8 | **Phase 13 operational drills** | AC-18 | backup/restore rehearsal in an isolated environment; budget alerts on paid-capable providers; rollback rehearsal; launch-config sign-off |

## 5a. Admin PWA (separate effort, 2026-09-12) — two more deploy-time actions

Not one of the 8 launch blockers above (this extends the existing admin
console rather than gating the storefront). Both items previously tracked
here as open are now done, confirmed 2026-09-13 while investigating D-111:

- **Migration `20260912114320_admin_push`** (purely additive — two new
  tables, `AdminPushSubscription`/`AdminNotificationPreference`, nothing
  altered or dropped on any existing table) — ✅ confirmed applied to the
  production Supabase database (`prisma migrate status` against the live
  `DATABASE_URL` reports all 5 migrations, including this one, up to date).
  The manual-step risk this bullet warned about is real and generalised —
  see blocker #7's new finding — but this specific migration was not missed.
- **`NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`**
  — ✅ confirmed present on Vercel across Production/Preview/Development.
  Push notifications should be live; not yet exercised end-to-end on a real
  device (still needs the Stage 5 physical-iPhone checklist, D-103).

Full detail: `docs/admin-pwa-plan.md`, `docs/admin-pwa-setup.md`,
`docs/admin-pwa-verification.md`, decisions D-99 through D-103.

## 6. Residual (non-blocking) polish

- `color-contrast` on dense admin data tables (muted palette) — recorded, deferred.
- Error / retry / loading-state matrix — the money-critical paths are covered
  (`PriceChangedError` reconfirm, failed-action surfacing, notification retry); a full
  sweep of every screen's empty/loading/error state is a polish pass.
- Split-shipment UI, advanced admin roles, real-time admin — deferred by scope
  (`deferred-scope.md`).
