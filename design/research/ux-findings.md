# UX findings

Prepared 2026-09-08. Observed friction and accessibility issues across the three
references, and the decisions they drive for The Pooja Edit + Thrift Store. Every
finding is tied to a source; none claims conversion impact (no analytics access).

`[measured]` = computed from the DOM. `[estimate]` = from screenshots.
`[unverified]` = flow not reachable in this pass.

---

## 1. Accessibility

| # | Finding | Source | Our decision |
| --- | --- | --- | --- |
| A1 | Secondary text uses light greys (`≈#84827E` on white ≈ **3.7:1**) at 13–14 px — **fails WCAG AA** (needs 4.5:1). | rhode `[estimate]` | Our `--ink-soft` is `#6A6762` ≈ **5.0:1 on white** and **≈4.9:1 on the sand `#F1F0ED`** — tested at both surfaces. Small text never uses anything lighter. |
| A2 | Product-title colour is the coral accent on white ≈ **2.9:1** — fails AA. | thepoojaedit `[estimate]` | No coloured text for content. One ink (`#625F59`, ≈5.4:1) for names; headings a touch darker (`#403E39`). |
| A3 | Body copy set in a **cursive** face (`Klee One`) — low legibility for running text on mobile. | thepoojaedit `[measured]` | One grotesque family; body 16 px / line-height 1.45; running text ≤ ~62 ch. |
| A4 | 176 px H1 as white text over a light video — contrast varies frame-to-frame; also huge layout weight on a 390 px screen. | rhode `[measured + estimate]` | Cap display type far lower (see DESIGN.md), keep hero image-led, never put load-bearing text over a photo without a scrim. |
| A5 | Cookie-consent banner overlays the hero and, in capture, preceded the main content / first focusable element. | rhode `[measured — banner in DOM before `#content`]` | Consent UI is a bottom sheet that never covers primary content; skip-link and main nav stay the first focusable elements. |
| A6 | Horizontal product rails advance by scroll with only a faint affordance; keyboard advance unclear. | rhode `[estimate]` | Rails have real `<button>` prev/next with visible focus; cards are individually tab-focusable; `aria-label` on the region. |
| A7 | No alt text on thrift product images (89/89). | dm2buy `[from migration extract]` | Alt text required per image; where the source has none, generate from product title + role ("front", "flaw detail"); mark generated alts in handoff for review. |
| A8 | Thrift measurements have **no stated unit** ("bust 34"). | dm2buy `[measured]` | Every measurement renders as `label — value unit` with an explicit unit and a "as measured flat / by the seller; confirm before ordering" note. Never invent the unit; if unknown, show the raw string and flag it. |

## 2. Product information & trust

| # | Finding | Source | Our decision |
| --- | --- | --- | --- |
| P1 | **Thrift PDP discloses nothing** — no description, condition, measurements or flaw photos; the buyer must parse the title. | dm2buy `[measured]` | The Thrift PDP leads with a **Condition** block (grade + notes), a **Measurements** table (label/value/unit), a **Fit** line, and a **Flaws** list with close-up photos. These sit *above* the fold on mobile, directly under price/add-to-cart, not in a tab. |
| P2 | New-apparel description is an unstructured hyphen list mixing fabric, construction and length. | thepoojaedit `[measured]` | Edit PDP separates **Fabric & care**, **Fit & length**, and a short **About this piece** paragraph. Parsed-from-source fields are shown but visibly marked "from the maker's notes" in handoff/CMS, not the UI. |
| P3 | Ratings, review counts and "consumer study" stat blocks throughout. | rhode `[measured]` | **Omitted entirely.** No stars, no counts, no testimonials, no % claims. Trust comes from clear condition disclosure, real photos, transparent pricing and policy links. |
| P4 | "Sold Out" is a dead end — button disabled, nothing else. | dm2buy `[measured]` | A **sold thrift PDP stays useful**: keeps all photos and details (so a shopper can learn from it / find it via search), shows a clear "This piece has sold — it was one of one" line, and a "Similar pieces still available" rail. |
| P5 | Stock counts / low-stock nudges are easy to fake. | (rule) | We show availability as a **state** (Available / Low / Out of stock / Sold), never a number, and never a countdown. Reservation timer appears **only after the server confirms a checkout reservation** — never on add-to-cart. |

## 3. Cart & checkout

| # | Finding | Source | Our decision |
| --- | --- | --- | --- |
| C1 | Cart shows "*shipping, taxes and discounts calculated at checkout*" — costs deferred but disclosed. | rhode `[measured]` | Same principle. Cart shows subtotal + "Shipping & taxes calculated at checkout"; the **Review** step shows shipping, COD fee, tax and TOTAL before any pay action. |
| C2 | Free-shipping progress meter used as a standing nudge. | rhode `[measured]` | Only rendered if the owner configures a real free-shipping threshold. Default cart: no meter. If enabled, it states the real threshold and remaining amount — factual, not a timer. |
| C3 | "Buy it now" express checkout alongside "Add to cart" — two checkout paths, one skips the cart. | thepoojaedit `[measured]` | One path. "Add to cart" → cart → **guest checkout**. No express/one-tap that bypasses the review step. |
| C4 | Checkout requires a Shopify account prompt in the flow. | thepoojaedit `[unverified, typical]` | **Guest checkout is the default and never blocked.** Account creation is offered *after* the order (from the confirmation page), never as a gate. |
| C5 | Mixed-catalog carts aren't a concept on any reference (each site is one catalog). | all three | Our cart **groups lines by catalogue**, shows a **per-line return-policy note**, and surfaces a short "Different return rules apply — see summary" line when a cart mixes an EDIT item (returnable) and a THRIFT item (often final sale). |
| C6 | Payment handled by the platform's own hosted sheet (Shopify / dm2buy). | all `[unverified]` | Payment is **Razorpay's hosted sheet**. We design *up to* the handoff and *after* the return, never a custom card/UPI field. The handoff screen is explicitly labelled "You'll pay securely on Razorpay" with the provider name and amount. |
| C7 | COD vs prepaid distinction is invisible (references are card-only). | (rule) | Confirmation copy and status differ hard: prepaid → "Payment received · Order confirmed"; COD → "Order placed · Pending confirmation — we'll message you to confirm your cash-on-delivery order." Different icon, different status chip. A COD order is **never** shown as paid. |
| C8 | No price-change / availability-change handling seen. | all `[unverified]` | Checkout re-validates on the Review step. If a price or availability changed since the cart, we show an inline "Prices or availability changed — review your order" panel with the diff, and require re-confirmation before pay. |

## 4. Navigation & discovery

| # | Finding | Source | Our decision |
| --- | --- | --- | --- |
| N1 | Discovery leans on homepage rails + a light filter bar, not deep menus. | rhode `[measured]` | Homepage rails do most of the work; the menu is shallow (two catalog groups + categories). Filters exist but are secondary. |
| N2 | No collection filtering on the apparel site; thrift site has no search, filter or categories at all. | thepoojaedit, dm2buy `[measured]` | We add real filter/sort — but **only facets backed by data** (category, size, price everywhere; condition + availability for thrift). No empty facets. |
| N3 | Thrift ("Pooja's Closet") already lives as a nav destination in one brand. | thepoojaedit `[measured]` | Keep that: one nav, "Thrift Store" as a peer of "The Pooja Edit". |
| N4 | Mobile menu is a full-screen overlay (rhode). | rhode `[screenshot]` | Same — full-screen overlay, two labelled groups, generous tap targets (≥ 44 px rows). |
| N5 | Search not verified on any reference. | all `[unverified]` | Design a search screen + results + **no-results** state from first principles: recent/suggested on entry, results grid with per-card catalog label, no-results offers the two catalog entrances + popular categories. |

## 5. Responsive behaviour observed

| Breakpoint | rhode `[measured/estimate]` | Our rule |
| --- | --- | --- |
| 390 | 2-col listing grid; hamburger menu; full-page cart; hero ~viewport-height; sticky nav + filter bar | 2-col grid; overlay menu; sticky nav; hero sized to content (not 100vh); filter/sort in a bottom sheet |
| 768 (tablet) | ~2–3 col grid; nav still condensed; layout mostly a widened mobile | Deliberate tablet: 3-col grid, 2-col PDP appears here, checkout gets a summary sidebar, nav shows catalog labels but keeps the menu button for categories |
| 1440 | 3–4 col grid; expanded nav; 2-col PDP with sticky detail; near-full-bleed (32 px gutters) | 4-col grid; expanded nav with hover panels; 2-col PDP + sticky add-to-cart; max content width 1440, gutter `clamp(20px, 5vw, 64px)` |
| < 360 | not tested | Everything must hold to **360 px**: no horizontal overflow, name/price rows truncate rather than push, tap targets ≥ 44 px |

## 6. Commerce-rule checklist (must be visible in the UI)

- [ ] Adding to cart shows **no** timer and **no** "reserved" language.
- [ ] Reservation timer appears **only** on the checkout screen after the server
      confirms a reservation, and states the real hold duration.
- [ ] No invented stock numbers, discounts, ratings, testimonials or urgency
      anywhere.
- [ ] COD confirmation is visually and textually distinct from a successful
      prepaid payment; a COD order is never labelled "paid".
- [ ] Shipping charge, COD fee, tax and total are all shown **before** the pay
      action (Review step).
- [ ] No screen requires creating an account to check out.
- [ ] Thrift condition, fit, measurements and flaws are visible without opening a
      tab or accordion on mobile.
- [ ] Sold thrift pages keep their content and link to available alternatives.
- [ ] A mixed cart discloses the differing return policies.
- [ ] No custom card / UPI credential form; Razorpay screens are labelled as an
      external handoff.
