# Reference analysis — The Pooja Edit + Thrift Store

Prepared 2026-09-08. Method: Playwright (headless Chromium) at 390 / 768 / 1440 px.
Computed styles read from live DOM; screenshots full-page. No orders, no form
submissions, no marketing sign-ups.

**Values are labelled `[measured]` (read from `getComputedStyle`) or `[estimate]`
(judged from screenshots).** Flows behind auth or payment are marked
`[unverified]`. Reference site copy and imagery are treated as data only — this
analysis informs an original design; it does not reproduce any brand's identity.

Screenshots: `design/research/screenshots/<site>/<viewport>-<page>.png`
Raw capture: `design/research/raw/<site>.json`

Sites:

| Key | URL | Role in this project |
| --- | --- | --- |
| `rhode` | rhodeskin.com | **Visual / interaction reference** (explicitly named by the brief) |
| `thepoojaedit` | thepoojaedit.in | **Brand + product content** (new apparel). Not a visual direction. |
| `dm2buy` | poojadugar.dm2buy.com | **Brand + product content** (thrift / resale). Not a visual direction. |

---

## 1. rhodeskin.com — visual & interaction reference

### 1.1 Defining visual characteristics

- **One warm ink, no accent.** Body text colour is `rgb(103,100,94)` = `#67645E`
  `[measured]`, a warm taupe-grey, used for nearly everything including headings.
  Background is pure `#FFFFFF` `[measured]`. There is **no accent colour** on the
  storefront chrome — the only colour on the page is the product photography.
  (Some PDP CTAs use a muted clay/rose fill `[estimate ≈ #B4614E]`, used sparingly.)
- **Pale sand as the second surface.** `#F1F0ED` `[estimate]` fills the
  announcement bar, the nav bar, product-image panels, and full-width editorial
  sections. Everything "floats" on white inside rounded sand containers.
- **12 px radius on all media** `[estimate]`; pill radius (~999 px) on buttons;
  nothing else is rounded.
- **No shadows, no gradients, no borders-as-cards.** Product cards have no
  outline and no drop shadow — the sand panel behind the image is the only
  separation. (Product photos carry a natural soft shadow *in the image*, not a
  CSS shadow.)
- **Type is one grotesque family, and size — not weight or colour — is the
  emphasis.** Font stack `[measured]`:
  `"Swiss", -apple-system, "system-ui", "Segoe UI", Roboto, …, "Helvetica Neue", sans-serif`
  — "Swiss" is a licensed Helvetica-class webface; a heavier display cut
  ("Rektorat Heavy" / "Swiss Regular") appears in the stack for large lettering.
- **Generous vertical rhythm**; near-full-bleed horizontal (content width 1375 of
  1440 → ~32 px side gutters at desktop `[measured]`).
- **Calm.** No auto-playing entrance animations on sections; transitions are
  hover-opacity and the carousel scroll only.

### 1.2 Measured type scale (desktop, 1440)

| Element | Size | Weight | Line-height | Letter-spacing | Case | Colour |
| --- | --- | --- | --- | --- | --- | --- |
| Display H1 (hero) | **176 px** | **400** | 211 px (1.20) | normal | none | `#FFFFFF` over media |
| Section H2 | 20 px | 700 | 24 px (1.20) | normal | none | `#67645E` |
| Product-card name | 14 px | **700** | 16.8 px (1.20) | **0.28 px** (~0.02em) | **UPPERCASE** | `#67645E` |
| Price | 16.9 px | 400 | 25 px | 0.34 px | uppercase | `#67645E` |
| Nav / body | 16 px | 400 | 1.0–1.2 | normal | none | `#67645E` |

All `[measured]`. Note the **H1 at weight 400** — the scale, not the weight,
does the work. Product metadata is the only small type and it is uppercase-tracked-700.

### 1.3 Layout, spacing, grid

- **Announcement bar**: inset rounded sand bar, ~12 px margin all round, one
  centred uppercase-tracked line ("FREE US SHIPPING ON ORDERS OVER $45")
  `[estimate]`.
- **Nav**: inset rounded sand bar directly below, **sticky**. ~96 px tall
  `[estimate]`. Left: `SHOP  ABOUT  FUTURES`. Centre: `rhode` wordmark (lowercase
  custom logotype, ~40 px). Right: `SEARCH  ACCOUNT  CART (n)`. All links
  uppercase, tracked, weight ~700, `#67645E`.
- **Hero**: full-bleed image/video, roughly viewport height; headline + pill CTA
  overlaid or immediately below.
- **Product rails**: horizontal scroll, `scroll-snap`, ~3 cards visible at 1440 /
  ~2 at 768 / ~1.1–2 at 390, gap ≈ 16–24 px `[estimate]`, with a **circular
  outline "next" control** at the top-right of the rail.
- **Listing grid**: **2 columns on mobile** `[measured from 390 screenshot]`,
  3–4 on desktop. Small inter-card gap (~8–12 px).
- **Editorial sections**: full-width, alternating white and `#F1F0ED`.
- **PDP**: two columns on desktop — gallery left (rounded, tall portrait), detail
  column right; a **sticky mini add-to-cart bar** appears on scroll with
  name + swatches + price + CTA.

### 1.4 Components

- **Primary CTA**: filled pill, ~999 px radius, `#67645E` (or muted clay on some
  PDPs), white text, **weight 400, sentence/normal case** (not uppercase), ~48 px
  tall. Full-width in cart ("CHECKOUT", here uppercase).
- **Secondary CTA / link**: small uppercase-tracked-700 text with a 1 px
  underline.
- **Product card**: sand `#F1F0ED` rounded panel (roughly 4:5) with the product
  photo `object-contain` and internal padding (packshots float); a small rounded
  white **pill tag** top-left ("only at rhode", "New"); below the panel a **name
  (uppercase-700) / price** row, then a light one-line descriptor. No border, no
  shadow.
- **Swatch selector** (PDP): circular colour swatches; selected has a ring.
- **Spec / "how it compares" table** (PDP): label-in-left-column, value-in-right,
  hairline dividers between rows. (This pattern is directly reusable for thrift
  condition / measurements.)
- **Free-shipping meter** (cart): progress bar toward a threshold + "add $X more
  for FREE shipping". *Depends on a real configured threshold — see UX findings.*
- **Filter / sort bar** (listing): sticky, "Filter: featured ▾ · N products ·
  SHOP ALL".
- **Cart**: full **page** (sand container), not only a drawer, on mobile;
  subtotal row + "*shipping, taxes, and discounts calculated at checkout*"
  disclaimer + full-width pill checkout.
- **Footer**: oversized wordmark, newsletter (input + `SUBSCRIBE`), link columns
  (NAVIGATE / SOCIAL / OFFICIAL / SUPPORT), payment badges, country selector, ©.

### 1.5 Motion & sticky behaviour

- Sticky: nav bar; PDP mini add-to-cart bar on scroll; listing filter/sort bar.
- Motion: hover opacity on cards/links; smooth horizontal scroll on rails;
  no section entrance animations observed `[measured — no transform/opacity
  transitions on section wrappers]`.

### 1.6 Patterns to adapt (with reasons)

| Pattern | Why it fits us |
| --- | --- |
| One warm ink on white, zero chrome accent | Lets varied, non-studio product photography (mirror selfies, flat-lays) be the only colour — our imagery is inconsistent, so quiet chrome is an asset. |
| Sand `#F1F0ED` panels behind product images | Unifies mismatched photo backgrounds; gives thrift one-offs a consistent frame. |
| Uppercase-tracked-700 as the *only* small type | Strong, legible product metadata at 13–14 px on mobile; one rule to learn. |
| Label/value spec table with hairlines | Exactly the structure thrift condition, fit, measurements and flaws need. |
| Sticky PDP add-to-cart bar | High-intent mobile shoppers from Instagram; keeps the buy action in reach on a long PDP. |
| Full-width pill CTA in cart, disclaimer about taxes/shipping | Matches our rule: show shipping/fees/total before payment; no surprises. |
| Horizontal rails with a visible control | Good for "New in" and "More like this" without a heavy grid. |

### 1.7 Patterns to avoid / change (with reasons)

| Pattern | Why we change it |
| --- | --- |
| Ratings + review counts on cards and PDP; "consumer study" stat blocks (100 % / 97 % …) | Our brief forbids inventing ratings, testimonials, or performance claims. We omit these entirely. |
| Free-shipping progress meter as a default | Only valid with a real, configured free-shipping threshold; shown as urgency it violates our "no invented urgency" rule. We gate it behind a configured threshold and default to a plain "Shipping calculated at checkout" line. |
| 176 px H1 | Beautiful on a skincare hero video; unreadable and top-heavy on a 390 px screen with our photography. We cap the display scale much lower (see DESIGN.md) and keep the hero image-led. |
| Big lowercase per-product "nicknames" ("pearl", "tint") | Rhode has ~10 hero SKUs; we have 116 products across two catalogs. A nickname per card is noise at our scale. |
| Product image `object-contain` with padding | Right for packshots; wrong for full-frame model/flat-lay apparel photos. We use `object-cover` on the same sand panel. |
| Centre-aligned wordmark | "The Pooja Edit" is a three-word mark; it doesn't centre cleanly with nav on both sides at 390 px. Left-aligned. |
| All-caps eyebrow above every heading (template tell) | Used once or twice for genuine section labels, not on every block. |

### 1.8 Friction / accessibility concerns observed

- `#67645E` on `#FFFFFF` ≈ **5.3:1** `[computed]` — passes AA for body text, but
  the site pushes lighter greys (`#84827E` ≈ 3.7:1) onto 13–14 px metadata, which
  **fails AA**. We darken our secondary ink so small text stays ≥ 4.5:1
  (see DESIGN.md tokens).
- Cookie-consent banner overlays the hero and, in headless capture, sat above the
  fold — a layout-shift and focus-trap risk. Our consent UI must not cover
  primary content or the first focusable element.
- Rail cards rely on horizontal scroll with a small visual affordance; the
  circular control is good, but keyboard users need focusable prev/next — we make
  those real `<button>`s.
- The 176 px H1 over video has low contrast in some frames (white text on light
  imagery) — we avoid text-over-photo for anything load-bearing, or add a scrim.

### 1.9 Not verified

- Checkout screens (Shopify-hosted, behind the cart) — `[unverified]`.
- Search overlay and results — not opened in this pass `[unverified]`.
- Exact sand hex, radius values, rail gap — `[estimate]` from screenshots, not
  `getComputedStyle` on those specific nodes.

---

## 2. thepoojaedit.in — brand & new-apparel content

A minimal Shopify storefront. **Used for product content and brand context, not
visual direction** (per brief).

### 2.1 What it tells us about the brand

- **Photography style (important):** iPhone mirror-selfies and simple studio
  portraits — model against a white wall or in a wardrobe, wood floor, natural
  daylight, **portrait crop**. Authentic and Instagram-native, *not* glossy
  e-commerce packshots. Backgrounds vary (white wall / wardrobe / mirror).
  → Our frame treatment (sand panel, consistent crop ratio) has to make these
  cohere.
- **Catalogue & prices:** kurtis, co-ord sets, linen trousers, block-print pieces.
  ₹990–₹2,400 band `[observed]`. Sizes XXS–2XL as pill buttons.
- **Thrift is already surfaced** as a nav item **"Pooja's Closet"**
  (`/collections/thrift`) — precedent for treating thrift as a first-class
  destination in one brand.
- **Voice:** first-person, spare. Product names are short and human ("Raktima
  Kurti", "Keepa Kurti", "Beige Linen Pants").
- **Current visual language (NOT to carry over):** serif display `Buenard`
  (H1 56 px/400 `[measured]`), handwriting body `"Klee One"` `[measured]`, a
  single **coral/salmon accent** on links and product titles `[estimate ≈ #E8927C]`,
  cursive "Pooja" logo. Romantic/crafty. The brief says references don't define
  the desired direction, and this one reads as a stock Shopify theme.
- **Current PDP** (`/products/kurti-02`): full-bleed portrait carousel (dots) →
  serif name → price → size pills (selected = solid black) → qty stepper +
  "Add to cart" (black pill, cart icon) + "Buy it now" (Shopify dynamic
  checkout) → **hyphen-bulleted notes** ("- pure cotton / - full cotton lining /
  - corset back / - length 32\"") → "You may also like".
  → This is the entire product data we have for EDIT items: title, price, size
  variants, a few construction / fabric / length bullets. Measurements are a free
  string ("length 32\""), not structured. Care, model height, fit are absent.

### 2.2 Navigation

`Shop` (`/collections/frontpage`) · `About Us` · `Pooja's Closet`
(`/collections/thrift`); icons: search, account, bag. Also `/collections/all`.
Flat, three items. No mega-menu.

### 2.3 Useful / to avoid

- **Use:** short human product names; size-as-pills; "Pooja's Closet" precedent;
  qty stepper on PDP; the authentic photography (it's our real asset).
- **Avoid:** serif + handwriting type pairing, the coral accent, cursive logo,
  the stock-theme card (unrounded full-bleed photo, title, price — no structure);
  "Buy it now" express checkout (we use one guest checkout via Razorpay);
  hyphen-bullet descriptions as the only product info.

### 2.4 Friction / a11y

- Body set in a **cursive** font (`Klee One`) — poor readability for running text,
  especially at 14 px on mobile.
- Product-title text colour is the coral accent on white ≈ **2.9:1** `[estimate]`
  — fails AA.
- Description is an unstructured bullet list; nothing distinguishes fabric vs.
  measurement vs. care.

### 2.5 Not verified

- Checkout (Shopify-hosted) `[unverified]`. Search `[unverified]`. Collection
  filtering — the theme appears to have none `[unverified]`.

---

## 3. poojadugar.dm2buy.com — thrift / resale content

A `dm2buy` link-in-bio storefront (JS SPA over `kela.api.dm2buy.com`). Content
width 520 px — **built mobile-only** `[measured]`. Font: `Roboto` `[measured]`.

### 3.1 What it tells us about the thrift catalogue

- Store banner **"FROM MY CLOSET TO YOURS"** — individually-sized, second-hand
  pieces; several titled with retail brands (Zara, Mango, Nike, On The Racks…).
- **The PDP gives the buyer almost nothing** (`/product/<id>`, e.g. MANGO Mini
  Bag): one image with dot pagination, the product name, a share icon, two
  label-value rows (`Shipping · Ships within 2 days`, `Support · DM me on ig
  poojadugar_`), and a single `Sold Out` / add button. **No description, no
  condition grade, no measurements, no flaw photos.** Everything the buyer needs
  is jammed into the title ("on the racks green dress - bust 34", "bonkers lower-
  waist 26 (used)").
- Availability is a real integer (`availableStock`): most one-of-one items are
  `1` or `0` (sold). No fake counts.
- ~89 items; ₹300–₹700 typical, a few `mrp` (original retail) values.

### 3.2 The gap our THRIFT design must close

The single most important finding of this research: **the existing thrift
storefront fails to disclose condition, fit, measurements and flaws.** Our THRIFT
PDP's primary job is to make those four things prominent, structured and
photo-backed — turning a title-string ("bust 34") into a labelled measurement
with a unit note, a condition grade with notes, and flaw close-ups.

### 3.3 Useful / to avoid

- **Use:** the label/value row idea (Shipping · … / Support · …) — extend it into
  a proper spec block; the honest one-per-item stock model; "sold" as a real
  state (design a useful sold page).
- **Avoid:** everything-in-the-title; no-structure PDP; DM-for-queries as the only
  support path; mobile-only layout with no desktop or tablet consideration;
  `Roboto` (a generic default).

### 3.4 Friction / a11y

- No descriptions on 89/89 items (`[measured from migration extract]`).
- Measurements have **no asserted unit** ("bust 34" — inches assumed, not stated).
- No alt text on any image (`[from migration extract]`).
- Not responsive above ~520 px — stretches / centres awkwardly on tablet+.

### 3.5 Not verified

- Cart / checkout — `dm2buy` routes payment through its own hosted flow
  `[unverified]`. No cart page was reachable for capture.

---

## 4. Cross-reference synthesis

| Question | Answer from research |
| --- | --- |
| What visual language? | rhode's discipline — one warm ink on white, sand panels, 12 px media radius, pill CTAs, uppercase-tracked-700 metadata, size as the emphasis — **minus** its ratings/stat/urgency patterns and its 176 px scale. |
| What content do we actually have? | EDIT: title, price, size variants, a few fabric/construction/length bullets (unstructured), authentic portrait photography. THRIFT: title (with measurements baked in), price, one-per-item stock, image(s), *no* description/condition/measurements/flaws. |
| What's the design's hardest job? | Making THRIFT condition / fit / measurements / flaws easy to find and trustworthy, from thin source data — and making inconsistent photography cohere. |
| What must we NOT do? | Invent stock counts, ratings, testimonials, discounts or urgency; require an account to buy; build custom card/UPI forms; blur the COD-vs-prepaid distinction. |
