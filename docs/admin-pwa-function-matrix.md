# Admin PWA — function matrix

Stage 1 audit for the admin-PWA effort. One row per function that exists today in
`/admin` (16 pages, 8 server-action files, 1 shipment-label route). Read every page,
every action file, the shared services they call, and `src/server/admin/guards.ts` /
`src/server/auth/require-admin.ts`. Live-verified against a local build (embedded
Postgres, `DEV_ADMIN_AUTH=1`, Supabase env blanked only for this check, restored
byte-for-byte after — see D-99's pattern) wherever noted; otherwise verification is
"code-read" (I traced the exact source, but did not click it).

**Status vocabulary** (as specified): `works` · `broken` · `placeholder` · `blocked-external`.
Nothing here is invented — a function not in this table does not exist in the app today.

**Auth pattern confirmed globally**: every server action and the label/invoice routes
independently call `requireAdmin()` (never rely on `/admin/layout.tsx`'s gate alone) —
this matches master §9's "every sensitive action independently calls `requireAdmin()`"
requirement. Verified by reading all 8 action files + 2 routes; no exceptions found.

---

## Overview (`/admin`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 1 | Needs Attention summary by type, count | `getOverview` → `src/server/analytics` | ADMIN | works | Home, top section | Tap a type chip → filtered Needs Attention | live (200, real data) |
| 2 | Open-work tiles: pending payment / pending COD / needs review / to fulfil | same | ADMIN | works | Home, tile row | Tap tile → filtered Orders | live |
| 3 | Financial summary — placed, captured, refunds, COD remittance, net (30d) | same | ADMIN | works | Home, summary cards | Tap "full analytics" → Analytics | live |
| 4 | Low-stock list (top 8) | `getOverview` (joins `ProductVariant.lowStockThreshold`) | ADMIN | works | Home, low-stock section | Tap item → Inventory | live. **Correction to the brief**: low stock is a real, working feature (per-variant `lowStockThreshold`, set on the product's variant form), not absent. |

## Needs Attention (`/admin/needs-attention`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 5 | List open tasks (≤200), priority + age ordered | `listOpenTasks` | ADMIN | works | Needs Attention (also embedded atop Home) | Card list, newest/priority first | live |
| 6 | Bulk resolve (reason required, ≤50, re-verifies each condition, partial-success report) | `runBulk` + `resolveTaskChecked` | ADMIN | works | Needs Attention | Multi-select cards + sticky "Resolve selected" bar | code-read (bulk form logic traced in full) |
| 7 | Single resolve with force + reason override (for task types with no automatic re-check — NDR, RTO, refund-failure) | `resolveTaskChecked` | ADMIN | works | Needs Attention, card detail sheet | Bottom sheet: reason field + confirm | code-read |
| 8 | Auto-poll while tab visible (15s→120s backoff) | `Poll` client component | — | works | Needs Attention, Orders, Notifications | Same visibility-aware polling; pause a stale poll in background tab | code-read |

## Orders (`/admin/orders`, `/admin/orders/[orderNumber]`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 9 | Search by order # / phone / email | `listOrders` | ADMIN | works | Orders list | Search field, sticky top | live |
| 10 | Filter by order status | same | ADMIN | works | Orders list | Bottom-sheet filter | live |
| 11 | Filter by payment method (prepaid/COD) | same | ADMIN | works | Orders list | Bottom-sheet filter | live |
| 12 | Filter by fulfilment status | same | ADMIN | works (desktop UI gap) | Orders list | Add to the mobile filter sheet (desktop has no dropdown for this — only reachable by hand-editing the URL or via an Overview deep-link) | code-read |
| 13 | Cursor pagination (Next only, no Prev) | same | ADMIN | works | Orders list | "Load more" at list end | live |
| 14 | Order detail: items, totals, timeline, payment attempts, shipment, returns, contact/address, customer link | `getAdminOrder`, `listActivity` | ADMIN | works | Order detail, grouped sections | Sectioned scroll, sticky action bar | live |
| 15 | Confirm COD order | `confirmCodOrder` | ADMIN | works | Order detail → Actions | Full-width button, confirm sheet (amount + one-line consequence) | code-read |
| 16 | Cancel order (reason required) | `cancelOrder` | ADMIN | works | Order detail → Actions | Confirm sheet: reason field required | code-read |
| 17 | Create shipment (Shadowfax) | `createShipmentForOrderNow` | ADMIN | works, guarded | Order detail → Actions | Button; disabled + explained if Shadowfax unconfigured | code-read |
| 18 | Reconcile shipment tracking | `reconcileShipmentNow` | ADMIN | works | Order detail → Shipment section | Button | code-read |
| 19 | Sync COD remittance | `syncCodRemittanceNow` | ADMIN | works | Order detail → Shipment section | Button | code-read |
| 20 | Issue invoice + render PDF | `issueInvoiceForOrder`, `renderAndStoreInvoicePdf` | ADMIN | works | Order detail → Actions | Button | code-read |
| 21 | **View invoice PDF** | `/order/[orderNumber]/invoice` route | none enforced beyond guest-token/customer-ownership | **broken** | Order detail → Actions | — | **code-confirmed**: the route checks a guest `ORDER_VIEW` token or `getCurrentCustomer()` order-ownership — **no `requireAdmin()` path at all**. An admin opening "invoice PDF" from the admin order page will get a generic 404 for any order that isn't their own personal customer account (i.e. essentially always). Traced `src/app/order/[orderNumber]/invoice/route.ts`, `getViewableOrderForCustomer`, `getCurrentCustomer` line by line — no admin bypass exists. Not yet reproduced against a live invoiced order (none in local seed data), but the code path is unambiguous. **This needs a real fix**, not just a mobile wrapper: either an admin-authorized branch in that route, or a separate `/admin/orders/[orderNumber]/invoice` route that calls `requireAdmin()`. Flagged as a decision below. |
| 22 | Refund (amount + reason, capped at refundable balance) | `requestRefundNow` | ADMIN | works | Order detail → Actions | Confirm sheet: exact amount, one-line consequence, reason | code-read |
| 23 | Add order note (free text, timeline entry) | `OrderEvent` create + audit log | ADMIN | works | Order detail → notes | Text field + button | code-read |
| 24 | View admin activity for this order | `listActivity` | ADMIN | works | Order detail → activity section | Read-only list | live |
| 25 | Download shipment label PDF | `getShipmentLabelNow` → Shadowfax `fetchLabel` | ADMIN | **blocked-external** | Order detail → Shipment section | Show "Not available from Shadowfax" instead of a dead link | code-confirmed: `fetchLabel` has no documented self-serve endpoint (D-88); the route always 502s in practice |
| 26 | Track shipment (external carrier link) | `shipment.trackingUrl` | ADMIN | works, conditional | Order detail → Shipment section | External link, opens in new tab/Safari | code-read |

## Inventory (`/admin/inventory`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 27 | Search variant by SKU / product title | `ProductVariant.findMany` | ADMIN | works | Inventory list | Search field | live |
| 28 | View on-hand / reserved / available per variant | same | ADMIN | works | Inventory cards | Card per variant | live |
| 29 | Stock correction (± delta, reason required, invariant-protected — never below reserved or zero) | `adjustStock` | ADMIN | works | Inventory card → correction sheet | Bottom sheet: delta stepper, reason, confirm with resulting on-hand shown before submit | code-read |
| 30 | View a variant's adjustment ledger | `listVariantLedger` (via `?variant=` query param) | ADMIN | works (desktop UI gap) | Inventory card → "History" | Add a tap target — desktop has no link/button into this, only reachable by hand-editing the URL | code-read |

## Returns (`/admin/returns`, `/admin/returns/[id]`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 31 | List returns (newest 60, no filter/search) | `ReturnRequest.findMany` | ADMIN | works (minimal) | Returns list | Card list; add a status filter on mobile since there's more room in a sheet than a desktop toolbar | live |
| 32 | Return detail: items, order link, reason, notes | `prisma.returnRequest` | ADMIN | works | Return detail | Grouped sections | live |
| 33 | Decide (approve / reject, reason required to reject) | `decideReturnNow` | ADMIN | works | Return detail → Workflow | Confirm sheet | code-read |
| 34 | Mark received | `markReturnReceivedNow` | ADMIN | works | Return detail → Workflow | Button | code-read |
| 35 | Inspect item (outcome: restock / damaged-discard, condition notes) | `inspectReturnItemNow` | ADMIN | works | Return detail → item card | Per-item sheet | code-read |
| 36 | Finalize inspection | `finalizeReturnInspectionNow` | ADMIN | works | Return detail → Workflow | Button, enabled only once every item is inspected | code-read |
| 37 | Resolve (refund / replacement / reject) | `resolveReturnNow` | ADMIN | works | Return detail → Workflow | Confirm sheet | code-read |
| 38 | Restock only via the inspect → finalize → resolve chain (no shortcut) | same | — | works (confirmed absence of a bypass) | — | — | code-read: no direct "restock" action exists outside this chain |

## Notifications (`/admin/notifications`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 39 | List failed deliveries (≤40) with last error | `NotificationDelivery.findMany` | ADMIN | works | Notifications, "Failed" section | Card list | live |
| 40 | Retry a failed delivery | `retryNotificationNow` | ADMIN | works | Notifications, per-card button | Button | code-read |
| 41 | List recent deliveries (≤40, all statuses) | same | ADMIN | works | Notifications, "Recent" section | Card list | live |
| 42 | Auto-poll | `Poll` | — | works | Notifications | Same as #8 | code-read |

## Customers (`/admin/customers`, `/admin/customers/[id]`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 43 | Search by name / email / phone | `searchCustomers` | ADMIN | works | Customers list | Search field | live |
| 44 | Customer detail: order history, consent flag | `getCustomerDetail` | ADMIN | works | Customer detail | Grouped sections | live |
| 45 | Add private note | `addCustomerNote` | ADMIN | works | Customer detail → notes | Text field + button | code-read |
| 46 | No contact-based order merging (guest orders never linked on a matching email/phone alone) | — | — | works (confirmed absence of an unsafe feature) | — | — | code-read + master §9 |

## Analytics (`/admin/analytics`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 47 | Financial summary (30d): placed, captured, refunds, COD remittance, catalogue split, net | `getFinancialSummary` | ADMIN | works | Analytics | Stacked cards, no charts invented — same numbers as source | live |
| 48 | Low-stock list (≤30) | `getLowStock` | ADMIN | works | Analytics, low-stock section | Card list | live |

## Products (`/admin/products`, `/admin/products/new`, `/admin/products/[id]`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 49 | List with catalogue/status/search filters + page-number pagination | `listAdminProducts` | ADMIN | works | Products list | Bottom-sheet filters, card list | live |
| 50 | Create draft product (catalogue radio, slug, title) | `createProduct` | ADMIN | works | Products → "New" | Full-screen form | live (renders) |
| 51 | Edit core details (slug, title, description, brand, HSN, SEO title/description) | `updateProduct` | ADMIN | works | Product edit, "Details" section | Full-screen form section | live |
| 52 | Publish / unpublish / archive, with a pre-publish validation checklist | `publishProduct`, `setProductStatus`, `validateForPublication` | ADMIN | works | Product edit, "Publication" section (sticky) | Buttons + inline checklist of what's missing | live |
| 53 | Add / update variant (SKU, size, colour, price, compare-at, on-hand, low-stock threshold, active) | `upsertVariant` | ADMIN | works | Product edit, "Variants" — one card per variant | Per-variant edit sheet or inline card form | live |
| 54 | Delete image | `ProductImage.delete` + audit | ADMIN | works | Product edit, "Images" — photo grid | Long-press or explicit delete icon per photo, confirm | code-read |
| 55 | Set primary image | transactional `updateMany`+`update` | ADMIN | works | Product edit, "Images" | Tap "Make primary" on a photo | code-read |
| 56 | **Upload a new image** | `requestProductImageUpload` + `confirmProductImageUpload` (`src/server/catalog/product-images.ts`) — signed-URL flow, path/type/size/dimension validation all built and exported | ADMIN | **placeholder — backend ready, zero UI** | Product edit, "Images" | Multi-select / camera, per-image progress | **live-confirmed**: `input[type="file"]` count is 0 on the real product-edit page. The service functions exist, are fully implemented against `StoragePort`, and are never imported or called from anywhere in `src/app`. This is real new work, not a mobile reskin of an existing flow — see the plan doc. |
| 57 | Closet (`THRIFT`) condition/measurements/flaws — condition grade, notes, original brand, fabric, labelled size, fit, alterations, authenticity/care notes, acquisition cost (admin-only), measurements as raw JSON | `upsertThriftDetails` | ADMIN | works (poor mobile fit) | Product edit, "Closet details" section | Structured fields as-is; measurements needs a friendlier key/value UI over the *same* JSON field — no shape change | live |
| 58 | View assigned collections (read-only) | `product.collections` | ADMIN | works | Product edit, "Collections" | Read-only chip list | live |

## Activity (`/admin/activity`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 59 | Full admin activity log (≤150): who, what, when, entity, reason | `listActivity` | ADMIN | works | More → Activity | Card list | live |

## Settings (`/admin/settings`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 60 | Credential health (configured / not set, per integration — never values) | `credentialHealth()` | ADMIN | works | More → Settings | Status list, icon+label+colour | live |
| 61 | Edit nonsecret settings (raw JSON per key: business/checkout/shipping/policy config), reason required, versioned | `updateSetting` | ADMIN | works (poor mobile fit) | More → Settings, one card per key | Same JSON textarea, sized/keyboarded for mobile (monospace, no zoom, adequate height); no shape change | live |

## Auth (`/auth/login`, `/auth/logout`)

| # | Route / action | Backend service | Role | Status | Proposed mobile screen | Mobile interaction | Verification |
|---|---|---|---|---|---|---|---|
| 62 | Sign in (email + password) | Supabase `signInWithPassword` | — | works | `/auth/login` | Already responsive (fixed this session — D-99); confirm keyboard doesn't cover the button | live |
| 63 | Sign out | Supabase `signOut`, POST-only | — | works | Bottom nav → More → Sign out | Confirm sheet (clears device state on the PWA — see plan) | code-read |
| 64 | Layout-level admin gate (defense in depth, not the only check) | `requireAdmin()` in `src/app/admin/layout.tsx` | — | works | — | — | live + code-read |
| 65 | **Forgot password** | none | — | **missing — build this** | New `/auth/reset` + a link on `/auth/login` | Full-screen form | Confirmed absent: `src/app/auth/` has only `login/` and `logout/`. Explicitly requested in the brief (4a). |

---

## Confirmed / corrected against the brief's "0. PROJECT FACTS"

- **Low stock exists and works** (#4, #48, #53) — per-variant `lowStockThreshold`, shown on
  Home, Analytics and settable on the variant form, feeds a real `LOW_STOCK` Needs-Attention
  task type. The brief's "I believe there are NO... low-stock feature" is incorrect; don't
  treat it as new work in Stage 4c/7a — it's an existing feature to carry over, and it *is*
  the threshold the brief's push-notification section asks about.
- **No CSV export anywhere** — confirmed by grep across `src/app/admin` and `src/server/admin`.
  Nothing to preserve or port.
- **16 pages, 8 action files** — both counts confirmed exactly.
- **112 `dark:` classes, light-only site** — confirmed, and **already fixed** (D-99, shipped
  in commit `eb54a9c` before this audit). Stage 2 step 4a's `@custom-variant dark` change is
  done; re-verify only, don't redo.
- **`NEXT_PUBLIC_SITE_URL` not set in production** — confirmed, and it's not cosmetic: I traced
  it into `publicEnv.NEXT_PUBLIC_SITE_URL`, which **defaults to `http://localhost:3000`** when
  unset (`src/lib/public-env.ts`). Every notification email's order/invoice link, and the
  D-96 logo `<img>` in email templates, currently builds an absolute URL from this — meaning
  **every transactional email link sent from production today points at `localhost:3000`**.
  This is a real, pre-existing bug, not something introduced by this effort. It's out of this
  task's scope to fix (that's an email-templates fix, not an admin-PWA one), but it's exactly
  why the brief's "build all links as relative paths" instruction for the new push/PWA work is
  correct — and it means the new work must not copy the existing absolute-URL pattern.
- **Shadowfax label/COD-remittance self-serve gaps** — confirmed (#25 and the analogous COD
  remittance status display, which is read-only from webhook/reconcile data, never a self-serve
  lookup call).
- **Admin shipping "serviceability" check** — the brief's summary of master §10 lists
  "Shipping: serviceability" as in-scope admin behaviour, but **no such admin-facing tool
  exists today**: Shadowfax's serviceability API (`checkServiceability` in
  `src/server/shipping/shadowfax.ts`) is called only from storefront checkout, never from any
  `/admin` page or action. This needs a decision (see below) — it isn't in the "16 pages"
  inventory and I won't invent it without confirmation.
