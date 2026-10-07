# Plan: owner feature requests A–D (2026-10-07)

The four requests from HANDOVER §8, with the owner's answers (2026-10-07) and
how each will be built. They ship one at a time, smallest first: **D → C → B → A**.
Each gets its own decision number when it ships. D-136 is already taken by the
unmerged `utm-attribution` branch, so these start at D-137.

Every step ends with `npm run check`, integration tests, `npm run test:e2e:local -- --project=chromium`,
then push and a live check on `thepoojaedit.in`.

---

## D. Shipping: Label free, ₹100 once per order with any Closet item

**Owner's rule:** Label-only order → ₹0. Any Closet item in the cart → ₹100,
charged once, however many Closet items (a mixed cart pays ₹100).

**Today:** `ShadowfaxProvider.quote` returns a flat ₹80 (`flatShippingPaise ?? 8_000`)
for every order. The test adapter charges ₹100.

**Build:**
1. Decide the fee in `computeQuote` (`src/server/checkout/quote.ts`), not in
   the provider. The provider keeps answering "is this PIN code served?".
   Fee = `hasClosetLine ? closetFlatPaise : labelFlatPaise`.
2. Amounts live in the `shipping.rules` setting (`getShippingRules`), with
   defaults `{ labelFlatPaise: 0, closetFlatPaise: 10_000 }`, so they can be
   changed later without a deploy. No admin screen for now.
3. Checkout and cart summary show "Free" when shipping is ₹0.
4. Policy copy: **no change** (owner, 2026-10-07: "no need"). The shipping
   page keeps saying charges are shown at checkout.
5. Tests: update the integration tests that assume ₹100 on Label carts, and add
   Label-only, Closet-only and mixed-cart cases.

**Watch:** shipping is included in the tax calculation (`computeOrderTax`
gets `shippingPaise`). A ₹0 fee must not break invoice rendering. Check the
invoice PDF for a Label-only order.

---

## C. "Sold out" switch that keeps the product on the page

**Owner's choice:** a separate switch. The product shows Sold out and can't be
bought, but its stock number is kept, so switching back restores it.

**Build:**
1. Migration (additive): `Product.markedSoldOut Boolean @default(false)`.
2. `deriveAvailability` (`src/server/catalog/public-shape.ts`): when the flag is
   on, return `SOLD` for a one-of-one Closet piece, otherwise `OUT_OF_STOCK`,
   before looking at stock.
3. Make it unbuyable everywhere:
   - `computeQuote` rejects it with "sold out" (covers carts that already hold it).
   - The add-to-cart button is disabled.
   - Variant `available` / `maxOrderQty` treat it as zero.
4. Listing order: `listPublishedProducts` already sinks out-of-stock products to
   the end. The flag must count as out of stock there too.
5. Storefront wording: the card tag and badge say **"Sold out"**. Today
   `OUT_OF_STOCK` shows no card tag. The PDP's "It was one of one, so it won't be
   restocked" message only shows for real one-of-ones.
6. SEO: the Product JSON-LD offer switches to `OutOfStock`.
7. Admin: a "Sold out" toggle in the product editor's status area, plus a quick
   toggle on the products list. Both are logged to admin activity.
8. Tests: unit (`deriveAvailability`), integration (quote rejects, listing
   order), e2e (toggle on, card says Sold out, add-to-cart disabled).

---

## B. Closet items: sizes and quantity by default

**Owner's choice:** new Closet items start with sizes and quantity open. Pooja
ticks "Only one piece" when it really is one of one.

**Today:** this already works if "one of one" is unticked. It's just
ticked by default and easy to miss.

**Build:**
1. Product editor: a new Closet product starts with `isOneOfOne = false`.
   Rename the checkbox to **"Only one piece (one of one)"** and add a one-line
   hint. Existing products keep their current setting. The DB default
   stays `true`, so nothing changes for existing rows.
2. Storefront card: the "One of one" tag currently shows on **every** Closet item
   (`product-card.tsx`: `product.isThrift ? "One of one"`). Show it only when
   `isOneOfOne`.
3. Check the automatic Closet SKU generation (`CLO-000123`) when a product has
   more than one size. Every row needs its own SKU.
4. Closet return policy stays final sale (`RETURN_POLICY.THRIFT`), whatever the size count.
5. **Per-size measurements (owner: yes, 2026-10-07).** Additive migration:
   `ProductVariant.measurements Json?`. In the editor, when a Closet product has
   more than one size, the measurements form appears once per size (same form
   component as D-122). With one size, it stays on `ThriftDetails.measurements`
   as today. The PDP shows the selected size's measurements and falls back to the
   product-level set. Public payload: add `measurements` per variant.
6. Tests: e2e creating a Closet product with two sizes and stock 3, and checking
   the storefront quantity picker allows up to 3.

---

## A. Discount codes at checkout

**Owner's choices:** codes can be **% off or ₹ off**. Each code chooses whether
it applies to **Label, Closet, or both**.

**Defaults I'll use unless told otherwise:**
- One code per order, no stacking.
- Codes are case-insensitive.
- Shipping is never discounted.
- No per-customer limit (checkout is guest-only).

**Data (one additive migration):**
- `DiscountCode`: `code` (unique, stored uppercase), `kind` (PERCENT | FIXED),
  `percentBps` / `amountPaise`, `appliesTo` (ALL | LABEL | CLOSET),
  `minSubtotalPaise?`, `startsAt?`, `endsAt?`, `maxRedemptions?`,
  `redemptionCount`, `isActive`, timestamps.
- `DiscountRedemption`: `discountCodeId`, `orderId` (unique), `releasedAt?`.
- `Order.discountCode String?`: a snapshot of the code used.

**Quote (`computeQuote`):**
1. Takes an optional `discountCode`. Validates that it's active, in its date
   window, under its usage limit, has eligible lines, and the eligible subtotal
   is at or above the minimum. Each failure gets a clear message.
2. Amount = % of the eligible lines' subtotal, or the fixed ₹ capped at that subtotal.
3. Spread it across the eligible lines in proportion to their value, exact to the
   paisa (largest remainder). Pass it as the per-line `discountPaise` that
   `computeOrderTax` already supports, so GST is computed on the discounted value.
4. The code and the discount are included in the quote `hash`.

**Placing the order (`placeOrder`):** inside the existing transaction, run a
conditional `redemptionCount + 1` that only succeeds while under the limit, and
create the `DiscountRedemption`. If the code ran out in the meantime, return
"This code has just run out" so the shopper can re-confirm.

**Releasing a use:** when an order is cancelled or expires unpaid, mark the
redemption released and decrement the count. Hook into the same paths that
call `releaseReservations`.

**Refunds and returns:** the discount sits on each order line, so a line refund
uses that line's post-discount total. Verify in `src/server/refunds` and run
the `money-safety-reviewer` subagent over the whole change.

**Checkout UI (`checkout-client.tsx` + `actions.ts`):** a "Discount code" field
with **Apply** that re-quotes with the code, and a summary line reading
"Discount (CODE) −₹X" with a Remove link. Errors appear under the field. The
code is carried into `placeCheckoutAction`.

**Admin:** a new `/admin/discounts` page (linked from More). It lists codes with
their usage count, and supports create, edit and deactivate. A code that has
been used can't be deleted, only deactivated. The order detail page shows the
code used. The invoice already prints the discount (check the PDF).

**Tests:**
- Unit: allocation sums exactly, rounding, fixed amount capped at the subtotal.
- Integration: each validation error, placement increments, cancel releases,
  two concurrent orders racing for the last use.
- e2e: apply a code at checkout and see the total drop.

---

## Owner answers (2026-10-07)

1. Shipping policy wording: no change needed.
2. Discount codes work on sale (compare-at) items too. The code applies to the selling price.
3. Closet items with several sizes need measurements per size (added to B, item 5).
