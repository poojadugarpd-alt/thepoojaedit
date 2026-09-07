# The Pooja Edit + Thrift Store — Master Specification / AI Agent Prompt

Version: 1.0 · Prepared: 7 September 2026  
Companion: [Execution Playbook](02-execution-playbook.md)

## 1. Agent mandate and document authority

You are the senior full-stack engineer building a complete, mobile-first Indian fashion e-commerce website for one brand with two catalogs: **The Pooja Edit** (original/new apparel) and **Thrift Store** (pre-loved, usually one-of-one pieces). Primary traffic comes from Instagram, including @poojadugar_. Build for a solo operator, credible brand presentation, low launch cost, and reliable real transactions.

This file defines the stable architecture and required behavior. The playbook defines implementation sequence, prompts, evidence, and review gates. Read both before coding. Execute only the authorized phase; preserve completed modules and contracts. Record progress separately. Do not rewrite this file to match an incomplete implementation.

The latest user-approved decisions override older referenced plans: use Supabase Auth, not Auth.js; Supabase Storage, not Cloudinary; PostgreSQL, not MongoDB. Ordinary implementation details can be decided and documented without approval. Changes to the stack, commerce invariants, security boundaries, tax treatment, or scope require a concrete change proposal and explicit approval. Fix defects locally rather than rebuilding the application.

## 2. Fixed stack and architecture

| Area | Required choice |
| --- | --- |
| Application | Next.js 15 App Router, TypeScript, React compatible with the selected Next.js 15 release |
| Runtime / hosting | Node.js 22, Vercel; pin a compatible supported 22.x patch |
| UI | Tailwind CSS, shadcn/ui, Radix primitives where useful |
| Validation / forms / client state | Zod, React Hook Form, Zustand for cart and transient UI |
| Database | Supabase Free PostgreSQL |
| Commerce data layer | Prisma ORM 7, PostgreSQL driver adapter |
| Identity / files | Supabase Auth with `@supabase/ssr` and `@supabase/supabase-js`; Supabase Storage |
| Payments | Razorpay first; provider boundary for Cashfree later; UPI and COD |
| Shipping | Shiprocket through a typed HTTP client |
| Background work | Inngest + PostgreSQL transactional outbox |
| Notifications | Meta WhatsApp Cloud API behind an abstraction; Resend + React Email; admin in-app |
| Operations | Sentry, Pino, structured logs with sensitive-data redaction |
| Tests | Vitest, real PostgreSQL integration tests, Playwright |

Use one application, one commerce database, and shared cart, checkout, customer, order, payment, shipping, invoice, and admin systems. Never create independent commerce backends for the two catalogs. Prisma owns ordinary commerce reads and writes; Supabase SDK usage is for Auth and Storage. Keep provider-specific payloads inside adapters.

```text
Browser → Next.js route/action → authenticated/validated domain service → Prisma → PostgreSQL
Browser → Supabase Auth; approved upload → Supabase Storage
Database transaction → domain event + outbox → dispatcher → Inngest → external side effects
Provider webhook → verify + durable inbox → idempotent domain transition + outbox
Admin → authorized domain services → same commerce database
```

Route handlers and Server Actions are thin adapters. Use React Server Components for public catalog content and metadata; client components for interaction. Database, payment, invoice, and integration handlers run in Node.js, not Edge. No synchronous email, WhatsApp, invoice, or shipment dependency may invalidate a committed payment.

Suggested boundaries:

```text
src/app/                   storefront, account, admin, API, auth routes
src/features/              catalog, cart, checkout, account, admin UI
src/components/            shared UI
src/server/                catalog, customers, inventory, checkout, orders,
                           payments, shipping, tax, invoices, refunds, returns,
                           notifications, admin, analytics, events
src/lib/                   db, supabase, env, money, logger
src/generated/prisma/      generated Prisma client
src/emails/                versioned email templates
src/schemas/               input validation
prisma/                    schema, immutable migrations, safe development seed
prisma.config.ts           Prisma 7 CLI configuration
src/middleware.ts          Next.js 15 session refresh / coarse route handling
```

## 3. Connections, environments, and deployment contracts

Use separate development and production Supabase projects where account allowances permit. Local Supabase is an acceptable development alternative. Vercel previews must never target production data or live payment credentials. Identify each environment visibly in admin.

- Runtime `DATABASE_URL`: copy the project's Supavisor transaction-pooler URL, normally port 6543, from Supabase's Connect panel.
- CLI `DIRECT_URL`: use Supavisor session mode, normally port 5432; an actual direct database connection is acceptable where network access supports it. The variable name does not imply a physically direct connection.
- Prisma 7: keep the PostgreSQL provider and generated-client output in `schema.prisma`; put the CLI datasource URL in `prisma.config.ts`; construct the runtime client with `@prisma/adapter-pg`, `pg`, and `DATABASE_URL`.
- Explicitly load environment variables for the Prisma CLI. Next.js loading `.env.local` does not make it automatically available to every CLI process. Validate this through a real connection check.
- Keep a reusable Prisma client per process; configure the adapter's pool size and timeouts conservatively for serverless concurrency. Do not connect/disconnect on every request.
- Prove the exact Prisma 7 adapter and Supavisor combination works under concurrency. Do not copy legacy Rust-engine query options blindly: transaction pooling and prepared-statement behavior must match the chosen driver and hosted pooler. Never disable TLS certificate verification to make a test pass.
- Use `prisma migrate dev` only against isolated development databases. Provide a separate disposable shadow database when necessary. Use reviewed `prisma migrate deploy` for release migrations. Never reset production, use `db push` there, or edit an already-applied migration.
- Prisma owns application tables only; preserve Supabase-managed `auth` and `storage` schemas. Version any necessary SQL constraints, RLS, grants, or policies alongside migrations with clear ownership.

Prisma 7 configuration and driver behavior are documented in [Prisma's upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7). Supabase documents the [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres) and [Prisma integration](https://supabase.com/docs/guides/database/prisma). Verify exact patch compatibility in phase 0; these sources do not authorize a major-version upgrade.

Create `.env.example` with descriptions and empty secret values. Validate server and public environments separately. Minimum groups:

| Group | Variables / configuration |
| --- | --- |
| Site | `NEXT_PUBLIC_SITE_URL`, environment identity |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY` if needed |
| Database | `DATABASE_URL`, `DIRECT_URL`, optional disposable `SHADOW_DATABASE_URL` |
| Razorpay | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Shiprocket | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, webhook verification configuration actually supported by the account/API |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET` |
| Email | `RESEND_API_KEY`, verified sender identity, webhook secret if callbacks are enabled |
| Jobs | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| Monitoring | Sentry DSN, server-only upload/auth token if used, log level |
| Business | Legal name, GSTIN, supplier state/address, invoice series, contact details, policies; editable nonsecret settings may live in PostgreSQL |

Secrets must never be stored in public configuration, committed, logged, or sent to the client. Missing optional providers must be visibly disabled; missing mandatory production configuration must block launch. Seed data and mocks must never masquerade as live integrations.

## 4. Catalog and storefront requirements

`CatalogType = THE_POOJA_EDIT | THRIFT`. Every product belongs to exactly one catalog. Use `@@unique([catalog, slug])`; resolve a detail page by both values. Apply catalog scope to queries, categories, collections, admin forms, merchandising, SEO, and analytics. Collection membership must not cross catalogs.

Required routes:

```text
/
/the-pooja-edit
/the-pooja-edit/[slug]
/the-pooja-edit/collections/[slug]
/thrift
/thrift/[slug]
/thrift/collections/[slug]
/search
/cart
/checkout
/order/[orderNumber]
/track-order
/account
/auth/login, /auth/register, /auth/callback
/about, /contact, /size-guide
/policies/shipping, /policies/returns-exchanges, /policies/privacy, /policies/terms
/admin and its operational modules
```

The homepage must immediately offer two clear catalog entrances. Shared typography, navigation, and checkout keep the brand consistent; catalog-specific content provides distinction. A mixed cart is required, with catalog labels and catalog-specific return-policy disclosure per item.

The Pooja Edit supports sizes/colors, quantities, restocking, collections, size charts, and compare-at prices. Thrift detail pages prominently show condition, original brand, labelled size, recommended fit, exact measurements with units, fabric, alterations, flaws, and flaw images. Acquisition cost is admin-only. Default thrift pieces have one sellable variant and quantity at most one across the physical piece. Do not model size labels as independently sellable copies of that piece.

Sold thrift URLs remain accessible with a SOLD state, disabled purchase controls, alternatives, and `OutOfStock` structured data. Draft and archived products are not purchasable. Separate publishing status from derived availability.

Use persisted Zustand cart entries containing variant IDs and quantities; displayed prices are informational. Revalidate stock and price on the server. Provide accessible loading, empty, unavailable, retry, and payment-pending states; keyboard controls, labelled forms, visible focus, mobile-friendly targets, responsive images, and no horizontal overflow at 360px. Preserve useful cart content after recoverable errors.

Use catalog-specific metadata, canonical URLs, Open Graph images, sitemap, and truthful Product structured data. Do not invent reviews. Exclude private account/admin/order pages from indexing and shared caches. Cache public catalog reads with deliberate invalidation after product/stock changes; cached stock never authorizes a sale.

## 5. Logical data model

Implement real relations, foreign keys, indexes, timestamps, and database constraints. This is a behavioral schema contract, not a complete copy-paste Prisma schema. Use UUIDs or another consistent opaque identifier, UTC timestamps, India-local display, and integer paise for all stored monetary amounts. Rates use a documented exact representation such as basis points or Decimal. JSON is for validated snapshots/provider metadata, not a substitute for core relations.

| Model | Required fields and relationships |
| --- | --- |
| Customer | ID; unique nullable `authUserId`; name; email/phone and normalized forms; timestamps; commerce preferences/consent. Guests have no auth ID. Contact fields are searchable, not proof of ownership. |
| CustomerAddress | Customer FK and editable saved address; never used as the historical order snapshot. |
| AdminUser | Unique Supabase auth ID; email; `OWNER` or `ADMIN`; active flag; timestamps. |
| Product | Catalog, slug, title, description, publication status, category FK, brand, HSN, tax-class FK, publication and SEO fields. |
| ThriftDetails | Unique Product FK; condition grade/notes, original brand, labelled size, fit, fabric, measurements, flaws, alterations, one-of-one flag, optional acquisition cost/date and authenticity/care notes. Required for THRIFT; absent for new apparel. |
| ProductVariant | Product FK; unique SKU; size/color; price/compare-at paise; on-hand/reserved quantities; low-stock threshold; weight/dimensions with units; active flag. |
| ProductImage | Product FK; bucket/path as canonical identifier; optional cached public URL; dimensions; alt text; sort position; primary flag; PRIMARY/GALLERY/DETAIL/FLAW type. |
| Category | Optional catalog scope, slug/name, parent FK. Enforce shared-category slug uniqueness explicitly; nullable composite uniqueness alone is insufficient. |
| Collection / ProductCollection | Catalog, unique catalog/slug, name, description, hero asset, active flag; join table unique product/collection with position. |
| InventoryReservation | Order and variant FKs; quantity; ACTIVE/CONVERTED/RELEASED/EXPIRED; expiry and terminal timestamp; unique logical reservation identity. |
| InventoryTransaction | Variant, optional order/admin; event type; on-hand and reserved deltas; reason; idempotency key; timestamp. Immutable ledger. |
| Order | Unique public order number; optional customer; contact snapshot; separate order/payment/fulfillment statuses; payment method; INR currency; source/UTMs; monetary totals; lifecycle timestamps; version for concurrency. |
| OrderItem | Order FK; optional retained product/variant references; immutable catalog, SKU, title, image reference, size/color, quantity, unit price, discount, HSN, tax treatment/rate, taxable value, CGST/SGST/IGST, total and return-policy snapshots. |
| OrderAddress | Order FK, address type BILLING/SHIPPING; immutable name, phone, lines, landmark, city, state/code, postcode, country. |
| CheckoutRequest | Scoped idempotency key, request hash, order/result reference, status, expiry; prevents duplicate checkout under retries. |
| OrderAccessToken | Order FK, hashed high-entropy token, scope, expiry, revocation; never plaintext token storage. |
| PaymentAttempt | Order FK; provider; provider order/payment IDs; amount/currency; status; verification metadata; stable operation key; timestamps. Multiple attempts per order allowed. |
| Shipment / ShipmentItem | Order FK, provider IDs, AWB, courier, normalized/raw status, tracking link, package dimensions/weight; item quantities with order-item FKs. One initial shipment, schema ready for splits. |
| ShipmentEvent | Shipment FK, external event identity, raw/normalized status, occurrence/receipt times, compact metadata. |
| CodRemittance | Shipment/order references, expected/collected/remitted amounts, provider reference, status and dates; distinguish delivery from remittance. |
| TaxClass / TaxRule | Treatment, HSN/configuration, exact rates, effective dates, applicability and inclusive/exclusive pricing policy. STANDARD enabled; margin treatment reserved but disabled. |
| Invoice / InvoiceSequence | Order FK, unique financial-year/series/number, issue time, legal/GST/address/line/tax snapshots, totals, private PDF path; atomic sequence allocation. |
| CreditNote | Original invoice/refund references, unique number, immutable adjustment/tax snapshots, issue time, private document path. |
| Refund | Order/payment FKs, provider refund ID, requested amount, reason, status, requesting admin, stable operation key, completion time. |
| ReturnRequest / ReturnItem | Order FK; reason, status, resolution, admin notes; item FKs, quantity, inspection outcome and condition. |
| OrderEvent / DomainEvent | Immutable business timeline and event ID/type/version/aggregate/payload; order timeline includes source and actor. |
| WebhookEvent | Provider and unique external event identity, event type, hash, protected minimal payload, processing state, attempt/error metadata, receive/process times. |
| OutboxEvent | Domain event reference, payload version, aggregate, availability, status, attempts, lease/lock expiry, last error, dispatch time. |
| SideEffectExecution | Event/operation identity, handler name, unique execution key, status, provider reference, attempts, last error; durable consumer deduplication. |
| NotificationTemplate | Key/channel/version/language; enabled flag; provider template IDs; variable schema. |
| NotificationDelivery | Event/order/customer; channel, recipient, template/version, provider message ID, status, attempts/errors and delivery times; unique logical delivery key. |
| AdminNotification | Entity reference, type/title/message/priority, read time; operator alert. |
| OperationalTask | Stable deduplication key; entity references; type, priority, open/resolved status, reason and resolution timestamps. |
| AdminActivityLog / CustomerNote | Verified admin FK; immutable action/entity/before-after/reason metadata; separate authored customer notes. |
| StoreSettings | Versioned, validated nonsecret business, checkout, policy and integration-enabled settings; audited changes. |

Required constraints: nonnegative stock and money where appropriate; positive line/reservation quantities; `reservedQty <= onHandQty`; unique SKU and order number; scoped provider payment/refund/shipment IDs; unique webhook identities and business-operation keys. Enforce thrift physical-piece limits in database-backed operations, including admin edits. Prevent deletes that erase financial history; archive products and retain snapshots instead.

Index at least: products `(catalog,status,publishedAt)` and `(catalog,categoryId)`; variant product FK; orders `(createdAt,id)`, `(paymentStatus,createdAt)`, `(fulfillmentStatus,createdAt)`, `(paymentMethod,createdAt)`, `(customerId,createdAt)`; normalized customer contacts; reservations `(status,expiresAt)`; outbox `(status,availableAt)` and lease expiry; shipments by provider ID/AWB/status; operational tasks `(status,priority,createdAt)`; notifications `(status,createdAt)`. Use deterministic cursor pagination for growing lists.

## 6. Pricing, GST, and financial history

The business has a GSTIN. **STANDARD configurable GST treatment is the default for both catalogs for now.** Reserve `SECOND_HAND_MARGIN` as a future schema/strategy extension, disabled in checkout. Do not infer margin eligibility or implement it based on acquisition cost.

Implement a tax service with configurable HSN/rates, supplier state, place of supply, effective dates, inclusive/exclusive pricing, shipping/fee treatment, and deterministic rounding. Store the resolved treatment, rates, inputs and split amounts on the order. Have the owner provide/confirm actual tax and invoice configuration before production; no invented GSTIN or guessed universal apparel rate. This specification defines software behavior, not a tax-law determination.

Define one totals contract: order subtotal is pre-tax merchandise value, discounts reduce that base, shipping and COD fee are pre-tax values, tax is the sum of applicable components, and `total = subtotal - discount + shipping + codFee + tax`. For tax-inclusive displayed prices, extract the base without adding tax twice. Allocate discounts deterministically, retain allocation snapshots, and ensure line sums reconcile exactly. Use integer/exact arithmetic with a documented rounding rule; never binary floating-point currency calculations.

Invoices have immutable legal, address, line and tax snapshots, financial-year series, and concurrency-safe numbering. Generate PDFs asynchronously into private Storage. Repeated jobs reuse the same invoice identity. Corrections/refunds retain the original invoice and use appropriate credit-note records, not historical rewrites. Invoice issuance timing and actual legal fields must be confirmed before launch. A document-generation failure creates an operational task and does not undo payment.

## 7. Inventory and checkout invariants

`available = onHandQty - reservedQty`. Cart additions never reserve stock. Default prepaid reservation TTL is approximately 10 minutes, configurable and displayed only after server confirmation.

1. Validate quantities/contact/address, product publication, catalog rules, serviceability, payment method and server-calculated quote. Require a phone number; email is optional for guests. Reconfirm changed prices before charging.
2. Deduplicate checkout by a scoped idempotency key plus request hash. Reuse with different input is a conflict, not a second order.
3. In one short PostgreSQL transaction, create pending order snapshots and reserve **all** variants with conditional updates/row locks in deterministic order. If any stock check fails, roll back everything.
4. Commit before calling the payment provider. Create/reconcile a stable provider-order operation outside the transaction and attach the returned reference safely. Handle provider success followed by a local timeout as an unknown outcome to reconcile.
5. Verified captured payment converts ACTIVE reservations once: decrease both on-hand and reserved quantities, append ledger entries, confirm order, and create outbox events in one transaction.
6. Expiry/release transitions only ACTIVE reservations once and decrements reserved quantity in the same transaction. Use database time and a scheduled sweep. Expiry racing payment conversion must serialize on the same state/rows.
7. A payment captured after expiry must not blindly confirm unavailable stock. Atomically reacquire every required item if still available; otherwise record the captured payment, mark the order for payment/inventory review, prevent fulfillment, and initiate the authorized refund/review workflow. Never hide a real payment as failed.

Refund success alone does not restore inventory. Restock only after an authorized cancellation of unshipped goods or physical return/RTO inspection, exactly once. Never restock merely from an RTO-in-transit webhook. For a unique piece, a returned/inspected item may become available again; a duplicate stock addition must not create a second physical copy.

COD must be configurable by postcode/serviceability, order value, catalog, and fees. Default confirmation window is a documented operational setting. At COD acceptance, atomically allocate stock into committed order stock (decrement on-hand; no prepaid-expiry reservation remains). Keep order `PENDING_CONFIRMATION` and payment `COD_PENDING`. Cancellation restores unshipped committed stock once; confirmation enables fulfillment. Track collection and later remittance separately. A COD order must never appear prepaid or paid merely because a shipment is delivered.

## 8. State machines and integrations

Maintain separate states with explicit legal transitions and transition preconditions:

| State machine | Minimum vocabulary |
| --- | --- |
| Order | PENDING_PAYMENT, PENDING_CONFIRMATION, CONFIRMED, NEEDS_REVIEW, CANCELLED, COMPLETED |
| Payment | UNPAID, PENDING, AUTHORIZED, PAID, FAILED, COD_PENDING, COD_COLLECTED, PARTIALLY_REFUNDED, REFUNDED |
| Fulfillment | UNFULFILLED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, NDR, RTO_IN_TRANSIT, RTO_RECEIVED, CANCELLED |
| Refund | REQUESTED, PROCESSING, COMPLETED, FAILED, NEEDS_REVIEW |
| Return | REQUESTED, APPROVED, REJECTED, IN_TRANSIT, RECEIVED, INSPECTED, RESOLVED |

Derive aggregate payment state from attempts/refunds; a failed second attempt cannot downgrade a successful payment. Preserve raw provider history and event times without allowing stale callbacks to undo terminal business facts. Shipping exceptions can occur multiple times; model events and allowed transitions rather than a simplistic status rank.

### Payments

Expose provider-neutral create-order, verify-checkout, verify-webhook, fetch/reconcile-payment, create-refund, and fetch-refund operations. Implement Razorpay fully; Cashfree remains an interface-compatible future adapter, not a fake working integration. Never accept browser success as proof of payment. Validate signature plus server-known provider order, payment ID, amount, INR currency, and captured/paid status. Authorization alone is insufficient for prepaid fulfillment.

Use raw webhook bytes for signature verification, then durably store/deduplicate the event before acknowledging it. If persistence fails, return a retriable failure. Process idempotently; unknown/mismatched orders go to review. Reconcile pending/ambiguous payments periodically. Enforce aggregate refund limits under concurrent requests, counting pending as well as completed refunds. Prevent duplicate captured attempts from causing duplicate fulfillment; flag excess captures for refund review. Razorpay documents [raw-body verification](https://razorpay.com/docs/webhooks/faqs/?preferred-country=US) and [asynchronous payment events](https://razorpay.com/docs/webhooks/).

### Shiprocket

Support serviceability, server-priced shipping quotes, order/shipment creation, courier/AWB allocation, labels, pickup handling where available, tracking, NDR, RTO, cancellations, and COD reconciliation. Refresh credentials server-side. Normalize provider responses into local records. Use stable merchant references and reconcile uncertain creation results before retrying to avoid duplicate shipments.

Verify incoming callbacks using the provider's actual documented account mechanism; do not invent an HMAC header because another provider has one. For weak/unavailable callback authentication, verify critical state against the authenticated API before transition. Store event fingerprints where no stable event ID exists. Periodic reconciliation covers missed callbacks. Admin overrides require reason, authorization, timeline entry, and audit; they cannot fabricate captured payments or bypass inventory guards.

### Outbox and Inngest

Write domain changes, DomainEvent, and OutboxEvent in the same transaction. A scheduled dispatcher claims bounded batches with expiring leases, sends a stable event ID to Inngest, and marks dispatch only after acknowledgment. A crash after send may cause redelivery: consumers must remain idempotent. Sweep pending events and expired leases, including when the original request process dies.

Use durable steps for independent effects and bounded exponential retries with jitter. Track consumer execution separately from dispatch; DISPATCHED does not mean shipment/email/invoice completed. Exhausted retries create deduplicated operational tasks and support audited replay. Handle remote success followed by a local crash through provider references/idempotency or reconciliation; do not promise universal exactly-once external effects. Inngest's [idempotency features](https://www.inngest.com/docs/guides/handling-idempotency) and [retry behavior](https://www.inngest.com/docs/guides/error-handling) supplement durable database deduplication rather than replacing it.

Required recurring work: reservation expiry, outbox dispatch/recovery, payment reconciliation, shipment reconciliation, and stale/failed operation alerts. Deploy and test real schedules; do not rely on Vercel request lifetimes or an in-process timer.

### Notifications

Channels: WhatsApp, email, admin in-app; SMS disabled for MVP. Version templates and validate variables. Use approved WhatsApp templates and recorded channel consent/preferences; missing email or WhatsApp eligibility must not block checkout. Keep transactional and marketing consent separate.

| Event | Customer delivery | Admin handling |
| --- | --- | --- |
| COD placed / prepaid confirmed | Appropriate order confirmation, without falsely claiming COD paid | New order / pending COD confirmation |
| Shipment dispatched | Tracking/AWB | Timeline |
| Out for delivery / delivered | Status update | Timeline |
| NDR | Actionable delivery message | Needs Attention task |
| RTO | Relevant return-to-origin update | Inspection task on receipt |
| Cancellation / refund completed | Accurate confirmation | Timeline; failures create tasks |
| Low stock / inventory conflict / failed background job | No generic customer blast | Deduplicated operational alert |

Persist deliveries keyed by event, recipient, channel, template and version. Track queued/sent/delivered/read/failed where supported. Authenticate status callbacks, handle stale callbacks, redact recipient details in logs, and provide audited retry. Use modest admin polling with visibility-aware backoff initially; no mandatory WebSocket infrastructure.

## 9. Identity, authorization, and storage security

Supabase owns identities, passwords, sessions, verification and OAuth. Customer accounts support email/password, login/logout/reset and account order history; checkout never requires registration. Lazy-upsert Customer by verified Supabase auth ID. Never merge or reveal guest orders based solely on a matching email/phone entered at checkout: link orders only after order-specific proof or another documented verified ownership flow. Contact matches are candidates, not authorization.

Validate identity on the server with supported Supabase verification methods; cookie contents or `getSession()` alone are insufficient authorization. Refresh cookies using Next.js 15-compatible middleware; current examples may use a newer framework's `proxy.ts` naming. Every sensitive action independently calls `requireAdmin()` or an ownership guard. Check active AdminUser and role from trusted storage; client-supplied metadata cannot grant roles. Provide secure initial-owner bootstrap and revocation. Supabase describes [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) and [validation limitations](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

Order numbers are identifiers, not credentials. Guest order/tracking/invoice access requires an expiring high-entropy scoped token or verified OTP flow; store token hashes, rate-limit attempts, and redact tokens from logs/analytics/referrers. Authenticated customers can access only their own orders. Return generic lookup errors to resist enumeration.

Prisma connections do not automatically inherit Supabase user JWT/RLS context. Enforce application authorization for all commerce queries and minimize runtime database privileges. Disable the Supabase Data API for commerce if unused, or lock down exposed tables with grants/RLS and test anonymous/authenticated denial. Preserve Auth and Storage operation. Never expose commerce tables by relying on UI route protection.

Product assets use public `product-images` with paths `the-pooja-edit/{productId}/{imageId}.webp` or `thrift/{productId}/{imageId}.webp`. Public reading is intentional; writes require verified active admin access. Issue short-lived signed upload URLs for server-selected paths, validate actual file type/size/dimensions, and confirm the object before persisting ProductImage. Prevent path takeover and arbitrary URL fetching. Compress/rescale photos, retain useful detail/flaw clarity, and use `next/image` with bounded allowed hosts.

Invoices, labels containing personal data, and private documents use private buckets and authorized short-lived downloads. Restrict Storage policies independently from table policies. Apply input validation, origin/CSRF protections for cookie-authenticated mutations, output escaping/sanitization, distributed rate limiting on abuse-prone endpoints, security headers, and secret/PII redaction. Never store card numbers, CVV, or UPI PIN. Define retention and restricted access for webhook payloads, addresses and logs.

## 10. Admin scope and operational behavior

Provide `/admin` overview and modules for orders, shipping, products, inventory, returns/refunds, customers, analytics, notifications, activity, and settings. Optimize for one operator with a shared shell, searchable tables, pagination, filters, contextual actions, and confirmation/reason capture for consequential actions.

- Overview: sales/orders by catalog, mixed-order allocation by line, COD vs prepaid, refunds, low stock, and Needs Attention.
- Orders: contact/address/item snapshots; three independent statuses; complete timeline; invoice; payment attempts; shipment; notes; guarded confirm/cancel/refund/return actions.
- Products: separate catalog forms, drafts/publication, variants, imagery, collections, prices and tax class. Thrift defects/measurements are required for publication.
- Inventory: available/on-hand/reserved, immutable adjustment history, reasoned corrections, low-stock alerts; no unrestricted quantity field that bypasses invariants.
- Shipping: serviceability, create shipment, AWB/labels, tracking, NDR/RTO actions and COD remittance discrepancies.
- Notifications/jobs: delivery attempts, failed operations, safe retries and resolution history.
- Customers: history and private notes, with access control and no insecure contact-based merging.
- Settings: verified business details, policies, COD/shipping rules, nonsecret integration state and templates. Show credential health without exposing credentials.
- Bulk operations: bounded selection, per-record authorization/eligibility, explicit confirmation, partial-success results, and audit records.

Needs Attention includes pending COD confirmation, payment review, inventory conflict, failed shipment creation/refund/background job, NDR, RTO inspection, and low stock. Resolve tasks when the underlying condition is resolved, not merely when an alert is read. Financial summaries derive from canonical payments/refunds and distinguish placed orders, captured revenue and COD remittance.

## 11. Launch scope, evidence, and non-negotiable acceptance criteria

MVP includes the two storefronts, shared guest/account checkout, Razorpay prepaid, configurable COD, protected accounts/admin, inventory reservations, Shiprocket operations, standard-GST snapshots/invoices, refunds/returns, notifications, durable jobs, and monitoring. Cashfree implementation, SMS, wishlist, loyalty, reviews, advanced promotions, preorders, complex multiwarehouse routing, advanced roles and margin GST are deferred. If a provider cannot be configured, label it blocked and do not declare full production readiness.

| ID | Acceptance requirement |
| --- | --- |
| AC-01 | Catalog routes/queries never leak another catalog; mixed carts remain supported. |
| AC-02 | Thrift condition/measurements/flaws are visible; sold URLs survive and cannot be purchased. |
| AC-03 | Guest purchase works without login; forged contact matches cannot expose or claim prior orders. |
| AC-04 | Simultaneous one-of-one checkout permits only one stock allocation; failed mixed reservations roll back entirely. |
| AC-05 | Expiry, capture, cancellation and retry races cannot produce negative stock, duplicate release/sale or accidental restock. |
| AC-06 | Browser price/status tampering fails; only verified matching captured payments confirm prepaid orders. |
| AC-07 | Duplicate/stale webhooks and double checkout do not duplicate orders, fulfillment, refunds or logical notifications. |
| AC-08 | Late capture and unknown provider outcomes are reconciled; no oversold order is silently fulfilled. |
| AC-09 | COD allocation, confirmation, cancellation, collection, RTO and remittance are distinct and auditable. |
| AC-10 | Missing/failed external side effects do not roll back paid orders; outbox recovery and audited replay work. |
| AC-11 | Tax/total calculations reconcile in paise; historical snapshots and unique invoice numbers remain immutable. |
| AC-12 | Every admin mutation and order/document read enforces authorization; Data API and Storage exposure tests pass. |
| AC-13 | Shiprocket sandbox/test evidence or documented provider-approved testing verifies creation, tracking, NDR/RTO and retry handling. |
| AC-14 | WhatsApp/email/in-app template and delivery paths work with test recipients; consent and missing channels are handled. |
| AC-15 | Admin can operate a complete prepaid and COD order lifecycle and resolve operational failures. |
| AC-16 | Mobile storefront, keyboard checkout, error states, SEO and no private caching pass browser review. |
| AC-17 | Clean database migrations, upgrade migrations, build, tests and isolated preview deployment pass. |
| AC-18 | Backup/restore exercise, rollback plan, provider reconciliation, schedules and launch configuration are documented and verified. |

Never mark mocked integrations as tested live. Record evidence and unresolved blockers for every criterion. Verify current Free-tier allowances, project pausing, database/storage/egress usage and recovery capabilities at deployment; do not assume free production operation or a particular backup entitlement. Document recurring provider charges and resource thresholds without silently upgrading paid plans. Configure budget alerts and demonstrate a recoverable backup including required assets. Production launch remains gated on real business settings, approved policies, provider credentials, and operational evidence.
