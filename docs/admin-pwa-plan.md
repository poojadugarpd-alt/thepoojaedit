# Admin PWA — plan

Stage 1 plan, built from `docs/admin-pwa-function-matrix.md`. Extends the existing
`/admin` — same app, same Prisma/Postgres database, same Supabase auth, same domain
services. Nothing here replaces a service or adds a second database.

## 1. Mobile navigation

Bottom tab bar, 4 items, `position: sticky; bottom: 0` with
`padding-bottom: env(safe-area-inset-bottom)`, each tap target ≥44×44:

| Tab | Route | Contents |
|---|---|---|
| Home | `/admin` | Needs Attention (top), open-work tiles, 30-day summary, low stock |
| Orders | `/admin/orders` | Search, filter sheet (status/payment/fulfilment), cards, order detail |
| Products | `/admin/products` | Filter sheet (catalogue/status/search), cards, product edit |
| More | `/admin/more` (new) | Inventory, Returns, Customers, Notifications, Analytics, Activity, Settings, **Install on iPhone**, Sign out |

The bottom nav is a new client component (`src/features/admin/mobile-nav.tsx`), shown
only below the `sm` breakpoint; desktop keeps the existing sidebar in
`src/app/admin/layout.tsx` unchanged. No new routes for Orders/Products — same
pages, responsive layout. `/admin/more` is a new lightweight index page (list of the
7 secondary modules + Install + Sign out); it does not replace their own routes.

## 2. Screen-by-screen (every function-matrix row placed)

- **Home** — Needs Attention chips (#1) at the very top per the brief; open-work tiles
  as a 2-col card grid (#2); 30-day summary as stacked cards (#3); low-stock list (#4).
- **Orders list** — search field, filter bottom sheet (status, payment method,
  fulfilment status — closing the desktop gap at #12), card per order (number, status
  pills, contact, total), "Load more" for cursor pagination (#13).
- **Order detail** — header (number, 3 status pills, placed date); grouped sections in
  this order: Items & totals, Actions (sticky button stack: confirm COD / create
  shipment / issue invoice / refund / cancel, each opening a confirm sheet), Shipment
  (AWB, tracking, reconcile, COD sync, label — shown as unavailable per #25), Timeline,
  Payments, Returns, Contact & address, Notes, Admin activity.
- **Serviceability checker** (new, decision #2) — a small tool on the Orders list
  screen (e.g. a "Check a pincode" row above the search field): enter a 6-digit
  pincode, call the existing `checkServiceability`, show served/not-served. Read-only,
  no order created or modified, no new backend logic — just a UI over an existing
  service function that today only checkout calls.
- **Products list** — filter sheet (catalogue, status, search), card per product
  (photo thumbnail, title, catalogue, status, variant/image counts, from-price).
- **Product edit** — two distinct forms selected by the product's catalogue (already
  separate in the data model, made visually separate on mobile too):
  - **Label form**: Details, Variants (card per SKU with price/stock/low-stock),
    Images (new upload UI — see §4), Publication checklist.
  - **Closet form**: Details, the one-of-one Variant, Images (with a "flaw photo" tag
    per image), Condition & measurements (structured UI over the existing JSON field),
    Publication checklist.
- **Inventory** — search, card per variant (on-hand/reserved/available), correction
  sheet (#29), ledger reachable from each card (closing the desktop gap at #30).
- **Returns list / detail** — card list with a status filter (new on mobile, #31);
  detail as grouped sections (items with per-item inspect sheet, workflow actions).
- **Customers list / detail** — search, card list; detail with order history and notes.
- **Notifications** — Failed section (card + retry button) above Recent (compact list).
- **Analytics** — the same 6 cards as desktop, stacked.
- **Activity** — reverse-chronological card list (desktop table becomes cards, not a
  shrunken table — nothing here needs column comparison).
- **Settings** — one card per settings key; JSON editor kept (no shape change) but
  sized and keyboarded for mobile.
- **Install** (`/admin/install`) — see §5 of the setup doc.

## 3. New database tables

Two new tables, additive migration only, forward-only (never editing the three
applied migrations).

```prisma
model AdminPushSubscription {
  id           String   @id @default(uuid(7)) @db.Uuid
  adminUserId  String   @db.Uuid
  admin        AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  endpoint     String   @unique
  p256dh       String
  auth         String
  userAgent    String?
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  lastSeenAt   DateTime @default(now()) @db.Timestamptz(6)

  @@index([adminUserId])
}

model AdminNotificationPreference {
  id           String   @id @default(uuid(7)) @db.Uuid
  adminUserId  String   @unique @db.Uuid
  admin        AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  newPaidOrder       Boolean @default(true)
  codConfirmation    Boolean @default(true)
  paymentIssue       Boolean @default(true)
  shipmentFailure    Boolean @default(true)
  ndrRto             Boolean @default(true)
  jobExhausted       Boolean @default(true)
  lowStock           Boolean @default(true)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)
}
```

One subscription row per device (a phone re-subscribing gets a new `endpoint`, old
rows are pruned on 404/410 from the push service). One preference row per admin,
defaulting all-on so existing behaviour (get everything) holds until someone opens
Settings and turns something off.

**Built in Stage 4, one change from this plan**: pruning "on logout" (as originally
sketched above) is deliberately NOT implemented — a push subscription is a
per-device thing, not a per-session one. Signing out and back in on the same phone
should not require re-enabling push; the subscription is scoped to the admin's
account (cascades on `AdminUser` delete) and stays live across sign-in/out. The
only two ways a subscription goes away are the push service reporting it gone
(404/410, handled automatically by `sendAdminPush`) or the admin explicitly
turning it off in Settings.

Migration file: `prisma/migrations/<timestamp>_admin_push/migration.sql`, reviewed
before applying, applied to local embedded Postgres first (`npm run db:migrate`),
never to the live Supabase project without explicit go-ahead.

## 4. New dependencies

| Package | Why | Notes |
|---|---|---|
| `web-push` | Sign and send Web Push messages (VAPID) | Server-only; not in `package.json` today — confirmed by grep |
| `browser-image-compression` (or equivalent, TBD after checking bundle size) | Client-side HEIC→JPEG conversion / downscale before upload, iPhone camera photos | Evaluate against "don't hold many full-size images in memory" — may end up using the Canvas API directly instead of a library; decide in Stage 4, not now |

No other new dependency is anticipated. Service worker is hand-written (no
`next-pwa`/Workbox) per the brief's narrow caching rules (§5d) — a generated SW is
harder to keep to "cache only versioned static assets + one offline page, never
authenticated responses."

## 5. New environment variables (names only, per the brief)

| Name | Used by |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser, to subscribe to push |
| `VAPID_PRIVATE_KEY` | Server, to sign push payloads (server-only, never shipped to the client) |
| `VAPID_SUBJECT` | `mailto:` or URL identifying the sender, required by the Web Push protocol |

All three added to `.env.example` with empty values and a comment, and to
`docs/integration-setup.md`'s variable-groups table — no values recorded anywhere in
the repo, matching how every other secret in this project is documented.

## 6. Decisions (resolved 2026-09-11, before Stage 2)

1. **Invoice-PDF 404 (matrix #21)** — **resolved: new route.** A separate
   `/admin/orders/[orderNumber]/invoice` route using `requireAdmin()`, matching the
   existing label-route pattern (`/admin/shipments/[id]/label`). The customer-facing
   `/order/[orderNumber]/invoice` route is untouched — its security model (guest
   token / customer ownership only) stays exactly as-is. The admin order-detail page's
   "invoice PDF" link is repointed to the new route.
2. **Admin shipping serviceability check** — **resolved: build it.** A small,
   read-only "check a pincode" tool using the existing Shadowfax
   `checkServiceability`, no order side-effects. Placed in the Orders area (see §2).
3. **Low-stock push batching** — **resolved: once per variant per day.** A SKU already
   notified about today won't push again until tomorrow, even if it drops further in
   the meantime. Implemented as a dedupe key of `low-stock-push:<variantId>:<YYYY-MM-DD>`
   alongside the existing `runOnce`/`SideEffectExecution` pattern.
4. **Settings JSON editor on mobile** — **resolved: keep JSON, resize for mobile.** Same
   textarea and data shape; only the sizing/keyboard treatment changes (monospace,
   16px+ to avoid iOS zoom, generous height). No new per-key structured forms.
