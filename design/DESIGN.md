# DESIGN.md — The Pooja Edit (The Label + The Closet)

Design direction, tokens and component contract for the customer storefront.
Version 1.0 · 2026-09-08. Companion research: `design/research/`.

This direction is **already realised in code** in `src/app/globals.css` and the
storefront components — the token names below map 1:1 to CSS custom properties so
the Figma file, this doc and the app stay in sync. Where a value here differs
from the current CSS, this doc is the target and the CSS should follow.

Scope: customer storefront only. Admin is a later task. Architecture and commerce
rules from `docs/01-master-specification.md` and `docs/02-execution-playbook.md`
are preserved — this is presentation, not behaviour.

---

## 1. Design principles

1. **One brand, two catalogs — differentiated by information, not decoration.**
   The Label and The Closet (D-93; formerly "The Pooja Edit" / "Thrift Store"
   as catalog names — the umbrella brand keeps "The Pooja Edit") share every
   pixel of chrome, type and colour. They diverge only where the *content*
   differs: the Closet adds a
   condition block, measurements, flaw photos, a one-of-one tag and an
   availability filter; edit adds size/stock variants. No second accent colour,
   no different font, no different layout for "the thrift side".
2. **The photograph is the only colour.** Chrome is one warm ink on white with a
   pale sand second surface. Our product photography is inconsistent (mirror
   selfies, studio portraits, flat-lays) — quiet chrome and a consistent frame
   are what make it cohere.
3. **Size carries hierarchy; weight and colour stay quiet.** Display type is
   large and regular-weight. The only small type is uppercase-tracked-700, used
   for product names, nav and genuine section labels.
4. **Structure is information.** Borders, dividers, tags and labels encode
   something true (a catalog, a condition, a return rule) — never ornament.
5. **Say the cost before the pay.** Shipping, COD fee and tax are visible on the
   Review step. No invented urgency, stock counts, ratings or discounts. Ever.
6. **Mobile is the design; desktop adapts up.** Primary traffic is an Instagram
   bio link on a phone. Every screen holds to 360 px.
7. **Calm.** Motion answers a user action (open, add, confirm). No section
   entrance animations, no carousels that move on their own.

---

## 2. Colour tokens

Committed **light** palette — the same on every device regardless of OS dark
mode (`color-scheme: light only`). Warm greige, zero accent.

| Token | Hex | Role | Contrast |
| --- | --- | --- | --- |
| `--ground` | `#FFFFFF` | page background | — |
| `--fill` | `#F1F0ED` | sand: announcement bar, nav bar, product-image panels, full-width sections, inputs at rest | — |
| `--ink` | `#625F59` | body text, most UI text | 5.4:1 on `--ground`, 5.0:1 on `--fill` — **AA** |
| `--ink-strong` | `#403E39` | headings, primary-button fill, price | 9.7:1 on `--ground` — **AAA** |
| `--ink-soft` | `#6A6762` | secondary text, captions, placeholders, meta | 5.0:1 on `--ground`, 4.9:1 on `--fill` — **AA** (this is the lightest text token; nothing lighter is used for text) |
| `--line` | `#D8D6D1` | hairlines, dividers, input borders | 1.3:1 — decorative only |
| `--line-strong` | `#C4C4C4` | carousel controls, stronger dividers | decorative |

**Semantic (state) colours** — kept deliberately muted; used for status text and
icons, never as the accent, never for large fills.

| Token | Hex | Role |
| --- | --- | --- |
| `--ok` | `#2F5233` on `--ok-bg #E4EDE2` | prepaid payment received, order confirmed |
| `--wait` | `#7A5A1E` on `--wait-bg #F3E7CF` | COD pending confirmation, payment pending, low stock |
| `--stop` | `#8A3320` on `--stop-bg #F0DFDA` | payment failed, sold out, validation error |

Status is always **icon + label + colour** (never colour alone) so it reads
without colour vision.

**No dark theme.** A design that commits to one warm light world; documented, not
omitted.

**Logo & brand colours (D-96).** `--brand-maroon: #7A1F2B` and
`--brand-beige: #EDE0CC` exist for one purpose: the "The Pooja Edit" wordmark,
signature and favicon/app icons (`src/components/brand/logo.tsx`, `src/app/icon.svg`,
`public/brand/*`). They are **not** part of the site's own palette above — no
button, link, price, status colour or text ever uses maroon or beige. If a
screen needs an accent, it stays within `--ink-strong`/the semantic colours;
the logo carries the only spot of colour on the site.

---

## 3. Typography tokens

**One family.** `"Helvetica Neue", Helvetica, <Inter>, Arial, "Segoe UI", Roboto,
system-ui, sans-serif`. Inter is loaded via `next/font` as the cross-platform
grotesque; macOS users get real Helvetica Neue. No serif, no second face, no
mono. (This mirrors rhode's "Swiss" strategy without licensing its webfont.)

| Token | Size (clamp: min → max) | Weight | Line-height | Tracking | Case |
| --- | --- | --- | --- | --- | --- |
| `display` | `2.75rem → 5.5rem` | **400** | 1.02–1.05 | -0.02em | sentence |
| `h2` | `1.6rem → 2.9rem` | 400 | 1.12 | -0.01em | sentence |
| `h3` | `1.2rem → 1.6rem` | 400 | 1.2 | -0.005em | sentence |
| `lead` | `1rem → 1.15rem` | 400 | 1.5 | 0 | sentence |
| `body` | `1rem` (16px) | 400 | 1.45 | 0.01em | sentence |
| `body-sm` | `0.9rem` (≈14px) | 400 | 1.45 | 0.01em | sentence |
| `label` | `0.8125rem` (13px) | **700** | 1.3 | **0.06em** | **UPPERCASE** |
| `eyebrow` | `0.75rem` (12px) | 700 | 1.3 | 0.08em | UPPERCASE |
| `nav` | `0.8125rem` (13px) | 700 | 1.0 | 0.09em | UPPERCASE |
| `price` | `0.85rem → 1.05rem` | 400 | 1.3 | 0.01em | sentence, `--ink-strong` |

> **Display cap.** Research measured rhode's H1 at 176 px. We cap `display` at
> `5.5rem` (88 px) — big and calm, but readable on a phone and not top-heavy with
> our photography. Hero remains image-led; load-bearing text never sits over a
> photo without a scrim.

Running text ≤ ~62 ch (`--measure`). Headings use `text-wrap: balance`.

---

## 4. Spacing, radius, layout

**Spacing scale** (4-based): `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72 · 96`
(px). Component internal padding and gaps come from this scale only.

**Radius:** `--radius-media: 12px` (every image / panel), `--radius-bar: 14px`
(announcement + nav sand bars), `999px` (pills), `10px` (inputs, small notes).
Nothing else is rounded.

**Layout:**

| Token | Value |
| --- | --- |
| `--gutter` | `clamp(20px, 5vw, 64px)` — page side padding |
| `--page-max` | `1440px` — content cap; centred above that |
| `--bar-inset` | `12px` — margin around the floating sand bars |
| `--section-y` | `clamp(64px, 9vw, 136px)` — vertical section rhythm |
| Grid | 4-col mobile / 8-col tablet / 12-col desktop, 16px gutter |
| Product grid | 2-col (< 640) · 3-col (640–1024) · 4-col (≥ 1024); column gap 12–18px, row gap 48px |
| Rails | horizontal scroll, snap; card width 78vw (< 640) / ~300px (≥ 640); gap 14–18px |

**Elevation:** none. No shadows. Separation is the sand panel, a hairline, or
whitespace — chosen by role, not stamped on everything.

---

## 5. Responsive behaviour

| | Mobile ≤ 640 | Tablet 641–1024 | Desktop ≥ 1024 |
| --- | --- | --- | --- |
| Nav | wordmark + hamburger; catalog labels hidden; overlay menu | wordmark + catalog labels; menu button for categories | expanded nav; hover/focus category panels |
| Hero | headline + 2 CTAs; sized to content | same, wider | same; optional editorial image band beside |
| Listing grid | 2-col | 3-col | 4-col |
| Filter / sort | "Filter & sort" button → **bottom sheet** | inline sort + collapsible filter row | left filter rail + inline sort |
| PDP | 1-col: gallery → details, **sticky add-to-cart bar** on scroll | 2-col begins: gallery ~55% / details ~45% | 2-col; details column sticky; no bottom bar needed |
| Cart | full page, lines stacked | full page, summary below | 2-col: lines + summary sidebar |
| Checkout | single column, stepped | single column + summary appears as a sticky card | 2-col: form + order-summary sidebar |
| Down to **360px** | no horizontal overflow; name/price rows **truncate**, never push; all tap targets ≥ 44×44 | | |

Breakpoints: `640 / 768 / 1024 / 1440`. Never a stretched mobile layout on
desktop — desktop gets a genuinely different composition (2-col PDP, summary
sidebars, hover nav), not the same screen widened.

---

## 6. Image treatment

- **Every product image sits on a `--fill` sand panel, 12px radius, `overflow:
  hidden`.** The panel is the constant; the photo behind it varies.
- **Aspect ratios:** product card panel **4:5**; PDP gallery main **4:5** (with a
  16:10 option for editorial/lifestyle); thumbnails **1:1**; hero editorial band
  **4:5 mobile / 16:10 desktop**; Instagram tiles **1:1**.
- **Fit:** `object-cover` (our apparel photos are full-frame model/flat-lay, not
  packshots). The sand panel shows only while the image loads or is missing.
- **Missing image:** the sand panel with a centred "No image" in `--ink-soft` —
  never a broken-image icon, never a stock placeholder.
- **Alt text:** required. Front / back / detail / flaw close-up roles where known.
  Generated alts (from title) are flagged for human review in handoff.
- **No filters, no duotone, no forced crop of faces.** Colour correction and
  consistent crop happen in asset prep, not CSS.
- **Instagram strip** uses real product images that link to the PDP — not
  embedded Instagram posts (avoids third-party embeds and unverifiable content).

---

## 7. Components & interaction states

Every interactive element has: **default · hover · focus-visible · active ·
disabled** (and loading where it performs async work). Focus-visible is a 2px
`--ink-strong` outline, 3px offset, on every focusable element — never removed.

### 7.1 Buttons

| Variant | Look | Use |
| --- | --- | --- |
| `pill` (primary) | filled `--ink-strong`, white text, weight 400, sentence case, radius 999px, min-height 48px (44px mobile) | Add to cart, Checkout, Place order, Notify me |
| `pill-ghost` (secondary) | transparent, `--ink-strong` text, 1px `--line-strong` border, radius 999px | Load more, Continue shopping |
| `textlink` | uppercase-tracked-700, 1px underline, `--ink-strong` | "All new pieces", "View the collection", inline links |
| `rail-control` | 44px circle, 1px `--line-strong` border, chevron icon | carousel prev/next |
| `icon` | 44px hit area, 20px icon, no fill | search, account, bag, close, share |

States: hover = opacity .84 (pill) / border darkens to `--ink-strong` (ghost) /
opacity .6 (textlink). Active = opacity .7. Disabled = opacity .4, `cursor:
not-allowed`, `aria-disabled`. Loading = spinner + label ("Adding…", "Working…"),
button stays sized, not replaced.

### 7.2 Product card

```
┌─────────────────────┐
│  ┌───────────────┐  │   sand panel 4:5, image object-cover
│  │ [SOLD] / [One │  │   optional white pill tag, top-left, 10px/700/uppercase
│  │  of one]      │  │
│  │      photo     │  │
│  └───────────────┘  │
│  PRODUCT NAME    ₹1,499   name = label token, truncate; price = price token, --ink-strong
│  Brand / fabric line     body-sm, --ink-soft, truncate      (optional)
└─────────────────────┘
```

- No border, no shadow. Whole card is one link.
- Hover: image opacity .9. Focus: outline on the card.
- Tag states: `SOLD` (thrift, sold), `One of one` (thrift, in stock), none (edit).
- Never shows a stock number or a rating.

### 7.3 Form fields

- Label above (13px, `--ink-soft`), input 44px min-height, 10px radius, 1px
  `--line` border, `--fill` or transparent background, `--ink` text.
- Focus: border `--ink-strong` + focus outline.
- Error: border `--stop`, a `--stop` message below with an icon, `aria-invalid`,
  `aria-describedby` the message. Errors state the fix ("Enter a 6-digit PIN
  code"), never "invalid".
- Radios/checkboxes: `--ink-strong` accent, 20px, 44px row hit area.
- **No custom card-number / UPI-ID fields anywhere.** Payment method is a choice
  (Pay online / Cash on delivery); the actual entry is Razorpay's sheet.

### 7.4 Badges / tags / status chips

| Chip | Look | Where |
| --- | --- | --- |
| `One of one` | white pill, `--ink-strong`, 10px/700/uppercase | thrift card + PDP |
| `SOLD` | white pill, `--ink-strong` | thrift card + PDP (sold) |
| `Available` / `Low` / `Out of stock` | text, `--ink-soft` (Low → `--wait`) | PDP availability line |
| `Payment received` | `--ok` icon + text on `--ok-bg` | prepaid confirmation, order status |
| `Pending confirmation` | `--wait` icon + text on `--wait-bg` | COD confirmation, order status |
| `Payment failed` | `--stop` icon + text on `--stop-bg` | failed payment, retry panel |
| `Final sale` / `Returnable` | `--ink-soft` text with a small icon | cart line note, PDP return line |
| Reservation timer | `--wait` text "Held for 9:59" | **checkout only, post-reservation** |

### 7.5 Navigation

- **Announcement bar:** inset sand bar, one centred `eyebrow`-token line. No
  dismiss, no rotation, no countdown.
- **Header:** inset sand bar, sticky, ~72px (mobile) / ~88px (desktop). Wordmark
  (`label` token, `--ink-strong`), catalog links + utility links (`nav` token).
  Bag shows `(n)` when non-empty.
- **Desktop category panel:** on hover/focus of a catalog link, a 2-column panel
  (category list + one image). Dismiss on blur/Esc.
- **Mobile menu:** full-screen overlay, `--ground`, close top-left, two labelled
  catalog groups then Search / Account / Help. Rows ≥ 44px. Body scroll locked;
  focus trapped; Esc closes.
- **Filter/sort sheet (mobile):** bottom sheet, drag handle, grouped facets,
  "Apply" (pill) + "Clear all" (textlink). Result count updates live.

### 7.6 Cart & checkout specifics

- **Cart** groups lines under a `label`-token catalogue header. Each line: image
  panel (h 96px), name (link), variant, unit price, qty stepper, remove
  (textlink). Per-line **return-policy note** (`Returnable within N days` /
  `Final sale — one of one`). Summary: `Subtotal (n items)` + "Shipping & taxes
  calculated at checkout" + `Proceed to checkout` pill. If the cart mixes return
  rules: a one-line "Different return rules apply — see each item" note.
- **Checkout** steps: (1) Contact + delivery address, (2) Delivery — method +
  fee, COD eligibility line, (3) Payment — two radios: **Pay online (UPI / card /
  netbanking)** and **Cash on delivery** (+ COD fee if any; disabled with reason
  if ineligible), (4) **Review** — line items, subtotal, shipping, COD fee, tax,
  **TOTAL**, then the pay action.
- **External handoff screen:** after "Pay ₹X", a brief interstitial — "You'll
  pay securely on Razorpay" + provider mark + amount + a spinner — clearly *not*
  our UI. On return: success / pending / failed states.
- **Order confirmation:** prepaid → `Payment received · Order confirmed` (`--ok`).
  COD → `Order placed · Pending confirmation` (`--wait`) + "we'll message you to
  confirm". Both: order number, items, address, totals, `Track this order` link.
  A COD order is **never** styled as paid.
- **Order / tracking page:** status rows (Order / Payment / Fulfilment / Method),
  shipping address, tracking (carrier = Shadowfax, AWB, status, link, event
  timeline), item table, totals. `Resume payment` panel if a prepaid order is
  still pending.

### 7.7 Empty / error / edge states

| State | Treatment |
| --- | --- |
| Empty cart | `h3` "Your cart is empty." + two textlinks (The Label / The Closet). No illustration. |
| No search results | "Nothing matched '<q>'." + the two catalog entrances + a few category links. Never a dead end. |
| Sold thrift PDP | full details retained; "This piece has sold — it was one of one, so it won't be restocked." + "Similar pieces still available" rail. |
| Product unavailable (added, then gone) | inline panel on cart/checkout: "<name> is no longer available" + Remove. |
| Price changed | Review-step panel: "Prices or availability changed" + old→new per line + "Review again" before pay. |
| Checkout validation errors | inline per field (see 7.3) + a summary `role="alert"` at the top listing the fields to fix. |
| Payment pending | `--wait` chip + "We're confirming your payment. No action needed — we'll email you." + order is visible, not paid. |
| Payment failed | `--stop` chip + "Payment didn't go through. Your order is saved." + `Try payment again` pill (re-opens Razorpay) + "or choose Cash on delivery". |
| Offline / load error | "Couldn't load this. Check your connection and retry." + Retry. In the app's voice, no apology. |

---

## 8. Accessibility requirements

- **Contrast:** all text ≥ 4.5:1 (≥ 3:1 for ≥ 24px or ≥ 19px-bold). Token table
  in §2 is pre-checked at both `--ground` and `--fill`. Status never by colour
  alone.
- **Focus:** visible 2px `--ink-strong` outline on every focusable element;
  never `outline: none` without a replacement. Skip-link is the first focusable
  element on every page.
- **Targets:** ≥ 44×44px for every control, including down to 360px.
- **Keyboard:** full flows operable by keyboard — menu, filter sheet, rails
  (real prev/next buttons + focusable cards), variant pickers, checkout. Overlays
  trap focus and close on Esc; focus returns to the trigger.
- **Semantics:** one `<h1>` per page; landmark regions (`header`, `nav[aria-label]`,
  `main`, `footer`); form fields have real `<label>`s; `aria-live="polite"` for
  "added to cart", result counts, and reservation timer; `role="alert"` for
  errors.
- **Motion:** `prefers-reduced-motion` disables all non-essential transition and
  smooth-scroll.
- **Images:** meaningful alt on product/flaw photos; decorative panels
  `alt=""`.
- **Language / currency:** `lang="en-IN"`; prices `₹1,499` via
  `Intl.NumberFormat('en-IN')`; measurements always carry a unit.

---

## 9. Rules for differentiating the two catalogs

The split is **informational, applied consistently**, never stylistic.

| Aspect | The Label | The Closet |
| --- | --- | --- |
| Chrome, type, colour, layout | identical | identical |
| Nav label | "Label" (short) / "The Label" (full) | "Closet" (short) / "The Closet" (full) |
| Listing header sub-label | "New apparel" (eyebrow) | "Pre-loved · one of each" (eyebrow) |
| Card tag | none (or `Low` / `Out of stock` text) | `One of one` (in stock) / `SOLD` |
| Card meta line | fabric / brand (if known) | condition grade + labelled size |
| PDP variant control | **Size** pills + qty stepper (multi-stock) | usually **no** variant; qty locked to 1 |
| PDP info blocks (in order, above the fold on mobile) | Price → Add to cart → About this piece → Fabric & care → Fit & length → Size guide link | Price → Add to cart → **Condition** (grade + notes) → **Measurements** (label/value/unit table) → **Fit** → **Flaws** (list + close-up photos) → About this piece |
| Availability model | in stock / low / out of stock (state, no number) | in stock (qty 1) / sold — and a "Show sold pieces" toggle on the listing |
| Return-policy note | "Returnable within N days" | "Final sale — one of one" (unless configured otherwise) |
| Sold state | rare; "Back in stock" interest (if configured) | common; keep page useful + alternatives rail |
| Filters | Category · Size · Price | Category · Labelled size · **Condition** · Price · **Availability** |
| Search result card | catalog label "The Label" | catalog label "The Closet" |

A shopper always knows which catalog they're in from the **nav label, the
listing eyebrow, and the card tag** — three quiet signals, no colour change.

---

## 10. Assumptions recorded

| # | Assumption | Why | Revisit when |
| --- | --- | --- | --- |
| AS1 | Display type capped at 88px (vs rhode's 176px). | Readability with our photography on phones. | Owner review of hero mockups. |
| AS2 | No free-shipping meter by default. | No configured threshold; would read as invented urgency. | Owner sets shipping rules. |
| AS3 | Thrift items are qty-1, no size variant, unless the source has `variantOptions`. | Matches migration data (9/89 have variants). | Per-item during catalogue curation. |
| AS4 | Return policy: EDIT = returnable window (N days, owner-set); THRIFT = final sale. | Legacy sites carry two policies (48h vs "all sales final"). | Owner reconciles the return policy. |
| AS5 | Measurement unit = inches when the source string implies it, shown with an explicit "as stated by the seller" note; raw string kept if ambiguous. | dm2buy asserts no unit. | Catalogue curation / owner. |
| AS6 | ~~Instagram strip = curated product images linking to PDPs, not live IG embeds.~~ **Superseded by D-84 (2026-09-09):** the strip pulls @poojadugar_'s latest posts via the **Behold.so** JSON feed, rendered with our own markup (no script / iframe / cookies). The curated product strip is now the **fallback** when the feed is unset or unreachable — progressive enhancement, not the default. | Owner request — primary traffic is the Instagram bio link. | Post-launch: move to the first-party Meta Graph API once the WhatsApp Meta app exists. |
| AS7 | Contact / support surface = a Help page + email/phone, not "DM on Instagram". | dm2buy's DM-only support doesn't scale. | Owner provides support email/phone. |
