# Module Map (Phase 0)

Derived from master specification §2 (suggested boundaries) and §5/§8 (domain services). This is the **target** layout that Phase 1 scaffolds and later phases fill in. Nothing here exists yet — the repo has no application code.

## Existing modules to preserve / reuse

Greenfield at Phase 0. **Built so far** (preserve / extend, do not rewrite):
- Phase 1: `src/lib/{app-env,env,public-env,logger,money}.ts`, the accessible shell, `/api/health`, middleware, instrumentation, test harness.
- Phase 2: `prisma/schema.prisma` (42 models), `prisma/migrations/` (`init` + `manual_constraints` — extend via additive migrations only), `prisma.config.ts`, `src/lib/db.ts` (the one Prisma client), `prisma/seed.ts`, `scripts/{pg,db-dev}.ts`, `tests/integration/**`.

## Target directory layout

```
src/app/                    storefront, account, admin, API, auth routes
src/features/               catalog, cart, checkout, account, admin UI (client-facing feature modules)
src/components/             shared UI (incl. src/components/ui from shadcn)
src/server/                 domain services — see table below
src/lib/                    db, supabase, env, money, logger
src/generated/prisma/       generated Prisma client (git-ignored)
src/emails/                 versioned React Email templates
src/schemas/                Zod input validation
prisma/                     schema.prisma, immutable migrations, safe dev seed
prisma.config.ts            Prisma 7 CLI datasource config (loads env explicitly)
src/middleware.ts           Next.js 15 session refresh / coarse route handling
```

## Domain services (`src/server/*`) and their responsibilities

Business logic lives here and is reused by route handlers, Server Actions, admin, and Inngest jobs. Route/action files are thin adapters only.

| Service | Owns | First built in |
| --- | --- | --- |
| `catalog` | Products, variants, categories, collections, images; catalog-scoped queries (`CatalogType`); publication vs derived availability; thrift one-of-one rules | Phase 4 |
| `customers` | Lazy upsert by verified Supabase auth ID (`lazy-upsert.ts` ✅); `normalize.ts` ✅; addresses / consent — Phase 4+ | Phase 3 (partial) |
| `auth` | `identity.ts` (Supabase seam), `require-admin.ts`, `current-customer.ts`, `errors.ts` — ✅ Phase 3 | Phase 3 |
| `inventory` | `available = onHand - reserved`; reservations (ACTIVE/CONVERTED/RELEASED/EXPIRED); immutable `InventoryTransaction` ledger; stock-bound constraints; restock only on authorized cancel / inspected return | Phase 5 |
| `checkout` | Quote calculation + expiry; idempotency (`CheckoutRequest` key + request hash); the short reserve-all transaction; COD allocation | Phase 5 |
| `orders` | Order/OrderItem/OrderAddress immutable snapshots; three independent status machines; order number allocation; `OrderEvent` timeline | Phase 5 |
| `payments` | Provider-neutral create-order / verify-checkout / verify-webhook / fetch-reconcile / create-refund / fetch-refund; Razorpay adapter; `PaymentAttempt`; aggregate payment state derivation | Phase 7 — ✅ **slice built** (`port`/`razorpay-crypto`/`razorpay`/`cashfree`/`testing`/`service`/`index`.ts; `/api/webhooks/razorpay`; checkout UI in `src/features/checkout`; `reconcile-payments` cron). Live Razorpay test evidence deferred (blocker #2). |
| `shipping` | Serviceability, server-priced quotes, shipment creation/reconcile, AWB/label/tracking normalization, NDR/RTO, COD remittance; Shiprocket adapter | Phase 8 (test adapter from Phase 5) |
| `tax` | Configurable HSN/rates, supplier state, place of supply, effective dates, inclusive/exclusive, deterministic rounding; STANDARD treatment only; `SECOND_HAND_MARGIN` reserved + disabled | Phase 5 |
| `invoices` | Financial-year sequence (atomic), immutable legal/line/tax snapshots, async private PDF generation, credit notes | Phase 9 |
| `refunds` | Aggregate refund limits (counting pending), provider refund reconciliation, stable operation keys | Phase 9 |
| `returns` | Return/ReturnItem lifecycle, inspection outcomes, explicitly authorized restock (exactly once) | Phase 9 |
| `notifications` | Versioned template registry, variable validation, consent/eligibility, Resend + WhatsApp adapters, `NotificationDelivery` dedup keys, in-app `AdminNotification` | Phase 10 |
| `admin` | `requireAdmin()` / ownership guards, active-role checks from trusted storage, owner bootstrap + revocation, `AdminActivityLog`, `CustomerNote`, bounded bulk actions | Phase 3 (guards) / Phase 11 (full) |
| `analytics` | Sales/orders by catalog, mixed-order line allocation, COD vs prepaid, captured revenue vs placed vs remittance, low stock | Phase 11 |
| `events` | Transactional `DomainEvent` + `OutboxEvent` producer; leased dispatcher; `WebhookEvent` inbox; `SideEffectExecution` consumer dedup; `OperationalTask` service; authenticated replay | Phase 6 |

## `src/lib/*`

| Module | Responsibility | Status |
| --- | --- | --- |
| `db` | Single reusable Prisma 7 client per process, `@prisma/adapter-pg` + `pg` pool + `DATABASE_URL`; conservative pool config | ✅ Phase 2 |
| `env` | Zod-validated server env, fails fast, production gate, live-credential guard | ✅ Phase 1 |
| `public-env` | Separate `NEXT_PUBLIC_*` schema, statically accessed | ✅ Phase 1 |
| `app-env` | `APP_ENV` (deployment identity) from `VERCEL_ENV`; dependency-free | ✅ Phase 1 |
| `money` | Integer-paise arithmetic, half-up rounding, basis-point helper; no float currency | ✅ Phase 1 |
| `logger` | Pino structured logging with secret/PII redaction | ✅ Phase 1 |
| `supabase/{config,server,client,middleware}` | `@supabase/ssr` factories + `updateSession`; degrade gracefully when unconfigured | ✅ Phase 3 |
| `storage` | `StoragePort` interface + Supabase impl; server-derived paths | ✅ Phase 3 (live impl exercised Phase 4) |
| `rate-limit` | In-memory fixed-window limiter (distributed version Phase 12) | ✅ Phase 3 |

## Runtime boundaries

- DB / payment / invoice / integration handlers run on the **Node.js runtime**, not Edge.
- React Server Components for public catalog content + metadata; client components for interaction only.
- `src/server/*` is server-only (guard with `server-only` import); nothing from it may reach a browser bundle.
- Provider payloads stay inside their adapter; the rest of the app sees normalized local types.
- Preview/dev must never resolve live credentials by fallback — env validation is environment-aware.
