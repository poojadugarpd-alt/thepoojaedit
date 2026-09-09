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
| 1 | **Supabase — ◐ dev/staging DONE, prod project outstanding** (D-85, 2026-09-09) | staging `poojaedit` project live: migrations + `policies/01`+`02` applied; **AC-12 verified live** (anon key → `42501 permission denied` on Product/Order/Customer/Variant; public `product-images` bucket → 200); legacy catalogue imported (115 products, 463 images on Storage); **COD checkout verified end-to-end** on the deployed site. **Still open:** a separate **production** Supabase project; real signed-URL upload + private-bucket download checks (AC-12 remainder); AC-03/AC-11 live auth (auth UI not built — `/account` hidden, guest checkout only); Supavisor+Prisma concurrency proof; Free-tier pause/backup entitlement check. |
| 2 | **Razorpay test-mode account** | AC-06 / AC-08 live evidence; the prepaid browser path | test keys + webhook secret; register `/api/webhooks/razorpay`; run a real UPI/card test payment + a real signed webhook |
| 3 | **Shadowfax merchant account + supported test arrangement** | **AC-13 (blocked)**, AC-09 live remittance | credentials; confirm the real endpoint paths/fields in `src/server/shipping/shadowfax.ts`; real shipment + tracking callback + label + COD remittance |
| 4 | **Meta WhatsApp (approved templates) + Resend (verified sender + Svix secret)** | AC-14 | submit the 8 template names for approval; verify the sending domain; real send to a test recipient on each channel |
| 5 | **Owner-confirmed business / tax / invoice configuration** | AC-11 (DRAFT watermark stays until then), live checkout/invoices | legal name, GSTIN, supplier state/address, HSN + GST rates per tax class, inclusive/exclusive policy, invoice series + issuance timing, COD/shipping rules, policy text; review the sample invoice PDFs |
| 6 | **Inngest project (dev + prod environments)** | the recurring schedules actually firing (they are wired + unit-proven, no live scheduled run yet) | create the project; register `/api/inngest`; set `INNGEST_*` |
| 7 | **Vercel project + isolated preview environment** | AC-17 (isolated preview deploy), AC-18 drills | create the project; scope env vars dev/preview/prod; Node 22; deploy a preview on dev/test services |
| 8 | **Phase 13 operational drills** | AC-18 | backup/restore rehearsal in an isolated environment; budget alerts on paid-capable providers; rollback rehearsal; launch-config sign-off |

## 6. Residual (non-blocking) polish

- `color-contrast` on dense admin data tables (muted palette) — recorded, deferred.
- Error / retry / loading-state matrix — the money-critical paths are covered
  (`PriceChangedError` reconfirm, failed-action surfacing, notification retry); a full
  sweep of every screen's empty/loading/error state is a polish pass.
- Split-shipment UI, advanced admin roles, real-time admin — deferred by scope
  (`deferred-scope.md`).
