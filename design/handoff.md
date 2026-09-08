# Handoff — The Pooja Edit + Thrift Store storefront design

2026-09-08. For Phase 4 (customer storefront) implementation. Preserves the
architecture and commerce rules in `docs/01-master-specification.md` and
`docs/02-execution-playbook.md` — this is presentation only.

Companion files:
- `design/DESIGN.md` — tokens, components, states, catalog-differentiation rules
- `design/research/reference-analysis.md` · `navigation-map.md` · `ux-findings.md`
- `design/research/screenshots/` — reference captures (3 sites × 3 viewports)
- `design/figma-plugin/` — the plugin that builds the editable Figma file

---

## 1. Screen & component inventory

### Foundations (Figma page 2)
Colour swatches (12 tokens), type scale (11 styles), spacing scale (11 steps),
radius samples (4).

### Components (Figma page 3) — all as component **sets with variants**
| Component | Variants |
| --- | --- |
| Button | `Variant` = pill / ghost / textlink · `State` = default / hover / disabled |
| Badge | `Kind` = one-of-one / sold / payment-received / pending / failed / final-sale / returnable |
| Field | `State` = default / focus / error |
| ProductCard | `Catalog` = edit / thrift · `Tag` = none / one-of-one / sold |
| Header | `Breakpoint` = mobile / desktop |
| AnnouncementBar, Footer | single component |
| (rail control, radio, size pill, chip) | built inline; promote to components in Figma if desired |

### Mobile Storefront (Figma page 4) — 390 px
1. Home — two catalog entrances (hero CTAs + split + two rails)
2. The Pooja Edit listing — grid, filter/sort bar
3. Thrift listing — grid with `One of one` / `SOLD` tags
4. Edit PDP — size variants, qty, add-to-cart + "Added to cart" confirmation, Fabric & care / Fit & length
5. Thrift PDP — Condition, Measurements (label/value/unit), Fit, Flaws (+ close-up), above the fold
6. Cart — mixed catalogues grouped, per-line return note, mixed-return-rules line
7. Checkout — guest, address, delivery + COD eligibility, Pay online / Cash on delivery, Review with shipping + fee + tax + TOTAL, "pay securely on Razorpay" handoff note
8. Order confirmation — prepaid (`Payment received`) and COD (`Pending confirmation`) as separate frames
9. Order + tracking — status rows, Shadowfax AWB, event note, items, totals
10. Mobile menu overlay — two labelled catalog groups
11. Filter & sort sheet — bottom sheet, sort + condition + size, live count, Apply / Clear all
12. Search results — box, count, grid, "per-card catalog label" note
13. Search — no results — the two catalog entrances + popular categories
14. Sold thrift PDP — details retained + "Similar pieces still available" rail
15. Cart — item unavailable & price changed — warning panel + per-line diff + "Review again"
16. Checkout — validation errors — top `role=alert` summary + inline field errors
17. Payment pending — `--wait` chip, "no action needed"
18. Payment failed & retry — `--stop` chip, "Try payment again" + COD fallback

### Desktop Storefront (Figma page 5) — 1440 px
Home · Thrift listing (left filter rail + sort) · Thrift PDP (2-col, gallery +
detail) · Cart (lines + summary sidebar) · Checkout (form + summary sidebar) ·
Expanded navigation (hover category panel).

### Responsive Examples (Figma page 6)
Listing and Checkout shown at **390 / 768 / 1440** side by side, including a real
**tablet (768)** composition for each.

### Prototype & Handoff (Figma page 7)
Flow list + the manual-wiring instructions.

---

## 2. Responsive rules (implementation)

| Token / rule | Value |
| --- | --- |
| Breakpoints | 640 · 768 · 1024 · 1440 |
| Page gutter | `clamp(20px, 5vw, 64px)` |
| Content max | 1440px, centred above |
| Sand bars inset | 12px margin, radius 14px |
| Product grid | 2-col < 640 · 3-col 640–1024 · 4-col ≥ 1024; col gap 12–18, row gap 48 |
| Rails | horizontal scroll + snap; card 78vw < 640 / ~300px ≥ 640; real prev/next `<button>` on ≥ 640 |
| PDP | 1-col + **sticky add-to-cart bar** < 768; 2-col ≥ 768 with a sticky detail column |
| Filter/sort | bottom **sheet** < 768; left rail + inline sort ≥ 1024 |
| Cart / Checkout | single column < 1024; 2-col with a summary **sidebar** ≥ 1024 |
| Down to 360px | no horizontal overflow; name/price rows **truncate** (`min-w-0 flex-1 truncate` + `shrink-0` price), never push; all targets ≥ 44×44 |
| Display type | `clamp(2.75rem, 1rem + 9vw, 5.5rem)` — capped at 88px (not rhode's 176) |
| Motion | `prefers-reduced-motion` disables transitions + smooth scroll |

These already match `src/app/globals.css` in the built app — keep them in sync.

---

## 3. Interaction notes

- **Add to cart** → in-place "Added to cart · View cart" (`aria-live=polite`,
  `--ok`). **No** timer, **no** "reserved" language on the PDP or cart.
- **Reservation timer** (`--wait`, "Held for 9:59") appears **only** on the
  checkout screen after the server confirms a reservation, and states the real
  duration. It is absent from every mockup except a checkout note.
- **Variant selection** (Edit PDP): size pills, selected = filled `--ink-strong`;
  unavailable size = struck-through + disabled; qty stepper bounded (thrift =
  fixed 1).
- **Filter/sort sheet**: opening locks body scroll, traps focus, closes on Esc /
  backdrop / "Apply"; result count updates live; "Clear all" resets.
- **Mobile menu**: full-screen overlay, focus trapped, Esc closes, focus returns
  to the ☰ trigger.
- **Checkout payment method**: two radios. Selecting "Cash on delivery" shows the
  COD fee (if any) inline; if the address is ineligible the radio is disabled
  with the reason. There is **no** card/UPI field — entry happens on Razorpay.
- **Razorpay handoff**: a labelled interstitial ("You'll pay securely on
  Razorpay", provider mark, amount, spinner) — visually not our UI. On return:
  success → prepaid confirmation; pending → payment-pending; failure →
  payment-failed-&-retry.
- **COD vs prepaid**: different chip (`Payment received` vs `Pending
  confirmation`), different icon, different status text. A COD order's Payment
  status reads `COD — ON DELIVERY`, never `PAID`.
- **Price / availability change**: caught at the checkout Review step; a warning
  panel lists each change; the pay button is replaced by "Review again" until
  re-confirmed.
- **Sold thrift**: page keeps all photos + condition + measurements (useful for
  search / learning); "This piece has sold — it was one of one" line; a
  "Similar pieces still available" rail.

---

## 4. Screen → route map

| Screen | Route(s) |
| --- | --- |
| Home | `/` |
| The Pooja Edit listing | `/the-pooja-edit`, `?sort=newest\|price_asc\|price_desc` |
| Thrift listing | `/thrift`, `?sort=…` (+ availability toggle) |
| Collection | `/the-pooja-edit/collections/[slug]`, `/thrift/collections/[slug]` |
| Edit PDP | `/the-pooja-edit/[slug]` |
| Thrift PDP | `/thrift/[slug]` |
| Search + no-results | `/search`, `/search?q=` |
| Cart (incl. unavailable / price-changed) | `/cart` |
| Checkout (incl. validation errors) | `/checkout` |
| Razorpay handoff | external — `checkout.razorpay.com` (not our route) |
| Order confirmation (prepaid / COD) | `/order/[orderNumber]?placed=1` (guest: `&token=`) |
| Payment pending / failed | `/order/[orderNumber]?review=1` / order page with resume-payment |
| Order + tracking | `/order/[orderNumber]` |
| Account (never required to buy) | `/account`, `/account/orders`, `/account/addresses` |
| Policies / size guide | `/policies/shipping`, `/policies/returns-exchanges`, `/policies/privacy`, `/policies/terms`, `/size-guide` |

---

## 5. Asset requirements

| Asset | Status | Note |
| --- | --- | --- |
| Product photography — EDIT | **exists** (`migration/legacy-content/images/thepoojaedit/`) | portrait mirror-selfie / studio; needs consistent crop to 4:5 and light colour balance for the sand panel |
| Product photography — THRIFT | **exists** (`migration/legacy-content/images/dm2buy/`) | 350 images; **no flaw close-ups** in the source — the owner must shoot flaw + tag detail photos for one-of-one pieces |
| Alt text | **mostly missing** | generate `front / back / detail / flaw` from role; mark generated alts for review |
| Hero / editorial imagery | **missing** | 1–2 lifestyle shots for the homepage band and the catalogue split; until then the sand panel shows and the rails carry the visual weight |
| Brand wordmark | **decision open** | current sites use a cursive "Pooja" and a lowercase mark — this design uses a plain uppercase-tracked "THE POOJA EDIT" wordmark; a drawn logotype can replace it without other changes |
| Favicon / OG image | **missing** | derive from the wordmark once set |
| Size guide | **missing** | one site-wide size chart (the legacy Shopify store reused a template image on ~25 products — see `migration/legacy-content/review-required.csv`) |
| Icons | use a single 20px stroke set | search, account, bag, close, share, chevron — Lucide or similar, one weight |
| Font | Inter via `next/font` (already wired) | Helvetica Neue on macOS via the stack; no webfont licence needed |

---

## 6. Unverified behaviour & open decisions

| # | Item | Owner / phase |
| --- | --- | --- |
| U1 | Reference checkout screens (Shopify / dm2buy hosted) not inspectable. | design assumption, validated against our own checkout in Phase 4 |
| U2 | Free-shipping threshold — no meter unless a real threshold is configured. | owner shipping config |
| U3 | Return policy split — EDIT returnable window (days) vs THRIFT final sale. | owner reconciles (legacy sites carry 48h and "all sales final") |
| U4 | Measurement unit — shown as inches with an "as stated by the seller" note; raw string if ambiguous. | catalogue curation |
| U5 | Thrift categories / conditions in filters come from real parsed data only — no empty facets. | catalogue curation |
| U6 | Instagram strip = curated product images → PDPs, not a live IG embed. | owner (if a real feed is wanted) |
| U7 | Support surface = Help page + email/phone, not "DM on Instagram". | owner provides support contact |
| U8 | COD eligibility rules (postcode / value / catalog) — UI has the slot; rules are owner-config. | owner |
| U9 | Whether the desktop nav category panel opens on hover or click (a11y prefers click/focus). | implementation — default to focus/click |
| U10 | Display-type cap (88px) — confirm on real hero mockups with photography. | owner review |

---

## 7. Guidance for Phase 4 implementation (no architecture change)

1. **The design is already partly in code.** `src/app/globals.css` holds the
   token layer (colours, type utilities, `.u-*` primitives, sand bars, rails).
   Keep the token names in DESIGN.md as the contract; the CSS should match this
   doc where they differ (notably: display cap, `--ink-soft` value, semantic
   colour tokens which are not yet in the CSS).
2. **Components map to `src/features/catalog/*` and `src/features/cart/*`** which
   already exist. The Figma component sets are the visual spec for
   `product-card.tsx`, `product-rail.tsx`, `price.tsx`, `availability-badge.tsx`,
   `catalog-listing.tsx`, `product-detail.tsx`, `add-to-cart.tsx`,
   `cart-view.tsx`, `checkout-client.tsx`, and `site-header.tsx` /
   `site-footer.tsx` / `announcement-ticker.tsx`.
3. **Thrift PDP is the biggest delta from what's built.** The current
   `product-detail.tsx` `ThriftDetailsBlock` renders condition / measurements /
   flaws lower down; move it **above the fold on mobile** per DESIGN.md §9 and
   the Figma "Thrift PDP" frame, and give Flaws its own list + close-up photo
   slot.
4. **Catalog differentiation is data, not a theme.** Do not fork components per
   catalog; pass a `catalog` prop and toggle: card tag, PDP info-block order,
   variant control, filter set, return-policy note, availability model
   (DESIGN.md §9 table).
5. **Commerce rules are UI-visible** — the `ux-findings.md` §6 checklist is the
   acceptance list for the storefront: no invented urgency/stock/ratings;
   reservation timer only post-reservation; COD ≠ paid; costs before pay; guest
   checkout never gated; Razorpay labelled external.
6. **Accessibility is a build gate** — DESIGN.md §8. The app already runs
   `@axe-core/playwright`; the token table is pre-checked at both surfaces, so
   keep small text on `--ink` / `--ink-soft` and never lighter.
7. **Responsive** — DESIGN.md §5 + this doc §2. Desktop is a different
   composition (2-col PDP, filter rail, summary sidebars), not a widened phone.
   Verify at 360 / 390 / 768 / 1024 / 1440; the e2e suite already asserts
   no-overflow at 360.

---

## 8. Tool limitations (disclosed)

- **No Figma write integration exists** in this workspace (no MCP, no API token,
  no plugin bridge). The Figma REST API cannot create canvas content; only the
  Plugin API can, and it runs inside the Figma app. The mockups are therefore
  delivered as the plugin in `design/figma-plugin/` for the owner to run once
  (`design/figma-plugin/README.md`). Until it is run, **the editable Figma file
  does not exist** — the design is fully specified (this doc + DESIGN.md +
  research + the plugin that builds it), but "editable Figma mockups" as a
  deliverable is **pending that one manual step**.
- Reference screenshots of rhodeskin.com are video-heavy; some hero frames render
  blank in headless capture. Type/colour/layout values were read from
  `getComputedStyle` where possible (marked `[measured]`); the rest are
  `[estimate]` from screenshots.
- Checkout flows on the reference sites are platform-hosted and were not
  inspected (`[unverified]`).
- The plugin binds text nodes to literal values, not to the named text styles
  (styles are created and editable; linking is a manual pass in Figma).
