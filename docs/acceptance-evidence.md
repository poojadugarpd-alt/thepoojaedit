# Acceptance Evidence Matrix (skeleton)

Maps master specification §11 acceptance criteria AC-01…AC-18 to the tests, commands, screenshots or provider evidence that prove them. **Skeleton only at Phase 0** — no evidence exists yet. Each row is filled as the owning phase completes. A mocked integration is never recorded as tested live; unconfigured providers are recorded `blocked`.

Status vocabulary: `not-started` · `in-progress` · `blocked` · `passed`

| ID | Requirement (abbreviated) | Primary phase(s) | Status | Evidence (test names / commands / artifacts) |
| --- | --- | --- | --- | --- |
| AC-01 | Catalog routes/queries never leak another catalog; mixed carts supported | 2, 4 | `in-progress` | **Phase 2:** `Product @@unique([catalog, slug])`; `tests/integration/schema.itest.ts` — same slug in two catalogs OK, dup `(catalog,slug)` rejected; `Collection @@unique([catalog, slug])`, `ProductCollection` cross-catalog prevented by app layer (Phase 4). Route-level isolation + mixed cart: Phase 4. |
| AC-02 | Thrift condition/measurements/flaws visible; SOLD URLs survive and cannot be purchased | 4 | `not-started` | — |
| AC-03 | Guest purchase works without login; forged contact matches cannot expose/claim prior orders | 3, 7 | `not-started` | — |
| AC-04 | Simultaneous one-of-one checkout → only one allocation; failed mixed reservation rolls back entirely | 2, 5 | `in-progress` | **Phase 2 foundation:** `tests/integration/concurrency.itest.ts` — 2 independent connections race for the last one-of-one unit → exactly one wins; 5 buyers vs 3 available → exactly 3; failure on a later mixed-cart item rolls back the earlier reservation. Full checkout: Phase 5. |
| AC-05 | Expiry/capture/cancel/retry races → no negative stock, no duplicate release/sale, no accidental restock | 2, 5, 9 | `in-progress` | **Phase 2 foundation:** CHECKs `onHandQty>=0`, `reservedQty>=0`, `reservedQty<=onHandQty`; thrift one-of-one trigger; `InventoryTransaction.idempotencyKey` unique; `InventoryReservation.reservationKey` unique + `status` enum. Race/expiry/restock logic: Phase 5/9. |
| AC-06 | Browser price/status tampering fails; only verified matching captured payments confirm prepaid orders | 5, 7 | `not-started` | — |
| AC-07 | Duplicate/stale webhooks & double checkout → no duplicate orders/fulfillment/refunds/logical notifications | 6, 7, 9, 10 | `not-started` | — |
| AC-08 | Late capture and unknown provider outcomes reconciled; no oversold order silently fulfilled | 5, 7 | `not-started` | — |
| AC-09 | COD allocation, confirmation, cancellation, collection, RTO, remittance are distinct and auditable | 5, 7, 8 | `not-started` | — |
| AC-10 | Missing/failed side effects don't roll back paid orders; outbox recovery + audited replay work | 6, 10 | `not-started` | — |
| AC-11 | Tax/total calculations reconcile in paise; historical snapshots + unique invoice numbers immutable | 2, 5, 9 | `in-progress` | **Phase 2 foundation:** all money `Int` paise; `Order` CHECK `total = subtotal - discount + shipping + codFee + tax` (+ component non-negativity); `OrderItem` immutable snapshot columns (catalog/sku/title/price/tax split/return policy); `Invoice @@unique([financialYear, series, number])` + `@@unique([orderId])`; `InvoiceSequence @@unique([financialYear, series])`. `src/lib/money.ts` unit-tested (Phase 1). Calc engine + immutability enforcement: Phase 5/9. |
| AC-12 | Every admin mutation and order/document read enforces authorization; Data API + Storage exposure tests pass | 3, 11 | `not-started` | — |
| AC-13 | Shiprocket sandbox/approved-test evidence verifies creation, tracking, NDR/RTO, retry handling | 8 | `blocked` — needs Shiprocket account + confirmed test mode | — |
| AC-14 | WhatsApp/email/in-app template + delivery paths work with test recipients; consent + missing channels handled | 10 | `not-started` | — |
| AC-15 | Admin can operate a full prepaid and COD lifecycle and resolve operational failures | 11 | `not-started` | — |
| AC-16 | Mobile storefront, keyboard checkout, error states, SEO, no private caching pass browser review | 4, 12 | `not-started` | — |
| AC-17 | Clean DB migrations, upgrade migrations, build, tests, isolated preview deploy pass | 1, 2, 12 | `in-progress` | **Phase 1:** `npm ci` clean · lint ✓ · typecheck ✓ · unit 19/19 ✓ · build ✓ · e2e 4/4 (chromium) ✓ · `npm audit --audit-level=high` ✓ 0. **Phase 2:** `prisma validate`/`generate` ✓ · `prisma migrate deploy` on an empty DB ✓ (integration global-setup) and on the seeded dev DB ✓ (no-op, status clean) · `npm run test:integration` ✓ **18/18** real PostgreSQL · seed idempotent ✓ · Prisma Studio boots ✓. CI adds an `integration` job (`postgres:17` service). **Remaining:** N→N+1 additive migration over data (Phase 4), isolated preview deploy (Phase 12). |
| AC-18 | Backup/restore exercise, rollback plan, provider reconciliation, schedules, launch config documented + verified | 12, 13 | `not-started` | — |

## Notes

- AC-13 is pre-marked `blocked` because it depends on an external account and a provider-supported test mode that has not been confirmed to exist. It cannot move to `passed` on mock evidence alone.
- AC-17 spans Phases 1 (build/lint/type/unit), 2 (migrations) and 12 (preview deploy) — record partial evidence per phase.
- Update the "Evidence" column with concrete, runnable identifiers (test file + case name, exact command, screenshot path, or provider dashboard reference), not prose.
