# Module Map (Phase 0)

Derived from master specification §2 (suggested boundaries) and §5/§8 (domain services). This is the **target** layout that Phase 1 scaffolds and later phases fill in. Nothing here exists yet — the repo has no application code.

## Existing modules to preserve / reuse

**None.** Greenfield repository. No prior app, no reusable modules, no migration history.

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
| `customers` | Lazy upsert by verified Supabase auth ID; addresses; consent/preferences; contact normalization (contact is a candidate, never proof of ownership) | Phase 3 |
| `inventory` | `available = onHand - reserved`; reservations (ACTIVE/CONVERTED/RELEASED/EXPIRED); immutable `InventoryTransaction` ledger; stock-bound constraints; restock only on authorized cancel / inspected return | Phase 5 |
| `checkout` | Quote calculation + expiry; idempotency (`CheckoutRequest` key + request hash); the short reserve-all transaction; COD allocation | Phase 5 |
| `orders` | Order/OrderItem/OrderAddress immutable snapshots; three independent status machines; order number allocation; `OrderEvent` timeline | Phase 5 |
| `payments` | Provider-neutral create-order / verify-checkout / verify-webhook / fetch-reconcile / create-refund / fetch-refund; Razorpay adapter; `PaymentAttempt`; aggregate payment state derivation | Phase 7 |
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

| Module | Responsibility |
| --- | --- |
| `db` | Single reusable Prisma 7 client per process, built with `@prisma/adapter-pg` + `pg` + `DATABASE_URL`; conservative pool config |
| `supabase` | `@supabase/ssr` server/client factories; server-side identity verification helpers |
| `env` | Zod-validated server env and public env, parsed separately; fails fast with a useful message on missing required config |
| `money` | Integer-paise arithmetic, documented rounding rule; no binary floating point for currency |
| `logger` | Pino structured logging with secret/PII redaction |

## Runtime boundaries

- DB / payment / invoice / integration handlers run on the **Node.js runtime**, not Edge.
- React Server Components for public catalog content + metadata; client components for interaction only.
- `src/server/*` is server-only (guard with `server-only` import); nothing from it may reach a browser bundle.
- Provider payloads stay inside their adapter; the rest of the app sees normalized local types.
- Preview/dev must never resolve live credentials by fallback — env validation is environment-aware.
