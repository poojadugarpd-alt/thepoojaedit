# Navigation & product-discovery map

Prepared 2026-09-08. How each reference organises navigation, and the proposed
IA for The Pooja Edit + Thrift Store. Reference structures are observations
`[measured]` / `[estimate]`; the proposed IA is ours.

---

## 1. Reference navigation structures

### 1.1 rhodeskin.com `[measured links]`

```
Announcement bar (sand pill)        FREE US SHIPPING ON ORDERS OVER $45
─────────────────────────────────────────────────────────────────────
Nav (sand bar, sticky)
  left:    SHOP  ·  ABOUT  ·  FUTURES
  centre:  rhode (wordmark → /)
  right:   SEARCH  ·  ACCOUNT  ·  CART (n)

SHOP → /collections/shop           (single landing; sub-collections:
                                    /collections/skincare, /collections/featured,
                                    /collections/shop — surfaced as in-page rails,
                                    not a dropdown menu in this capture)
ABOUT → /pages/about-us
FUTURES → /pages/philanthropy
```

- **No mega-menu / dropdown** was exposed on hover at 1440 in this capture
  `[unverified — may open on click]`. Discovery is driven by the **homepage
  rails** and the **listing filter/sort bar**, not by a deep menu.
- Mobile: hamburger (left) opens a full-screen menu `[screenshot: rhode/390-menu.png]`.
- Listing has a sticky **Filter / Sort** bar: `Filter: featured ▾ · N products ·
  SHOP ALL`.

### 1.2 thepoojaedit.in `[measured links]`

```
Nav (flat, not sticky-observed)
  Pooja (cursive logo → /)
  Shop → /collections/frontpage
  About Us → /pages/about-us
  Pooja's Closet → /collections/thrift
  icons: search · account · bag
also: /collections/all
```

- Flat, three items, **no dropdown**. Thrift is a **named collection**
  ("Pooja's Closet"), not a separate site — a useful precedent for one brand /
  two catalogs.
- No visible collection filtering `[unverified]`.

### 1.3 poojadugar.dm2buy.com

```
No site nav. Link-in-bio storefront:
  "Pooja Dugar" title → single scrolling product list → /product/<id>
  footer: Shipping & Return · Contact Us
```

- Discovery = one long scroll. No categories, no filter, no search.

---

## 2. Proposed IA — The Pooja Edit + Thrift Store

One brand, one nav, one cart. Two **catalogs** with distinct identities inside it.

### 2.1 Global navigation

**Desktop (≥ 1024) — expanded nav in an inset sand bar, sticky**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  THE POOJA EDIT        The Pooja Edit ▾   Thrift Store ▾        Search  Account  Bag (n) │
└──────────────────────────────────────────────────────────────────────────┘
        │                      │
        │                      └── on hover/focus: a 2-column panel
        │                           ┌─────────────────────────────┐
        │                           │  SHOP THE POOJA EDIT         │  [image: newest edit piece]
        │                           │   New in                     │
        │                           │   Kurtis & tunics            │
        │                           │   Co-ord sets                │
        │                           │   Trousers & linen           │
        │                           │   View everything →          │
        │                           └─────────────────────────────┘
        └── wordmark → home

Thrift Store ▾ panel:
   SHOP THRIFT STORE
    New arrivals
    Kurtis & sets
    Dresses & tops
    Trousers
    Bags & accessories
    Everything one-of-one →
   [image: a current thrift piece]  +  short line: "Pre-loved. One of each. When it's gone, it's gone."
```

- Categories come from the migration data's parsed types; where a catalog lacks a
  category it is simply omitted (no empty links).
- The two catalog labels are the **only** place the split is asserted in the nav.

**Mobile (< 768) — hamburger → full-screen overlay menu**

```
┌───────── overlay ─────────┐
│ ✕                          │
│                            │
│  THE POOJA EDIT            │   ← group header
│    New in                  │
│    Kurtis & tunics         │
│    Co-ord sets             │
│    Trousers & linen        │
│    Shop everything         │
│  ───────────────────────   │
│  THRIFT STORE             │   ← group header
│    New arrivals            │
│    Kurtis & sets           │
│    Dresses & tops          │
│    Bags & accessories      │
│    Shop everything         │
│  ───────────────────────   │
│  Search                    │
│  Account                   │
│  Help & shipping           │
└────────────────────────────┘
```

- Two clearly labelled groups; catalog identity carried by the group header only.
- Search is a menu row on mobile (opens the search screen), an icon on desktop.

### 2.2 Homepage — two clear catalog entrances (brief requirement)

```
Announcement bar (sand)  — one calm line, no countdown, no urgency

Hero
   eyebrow · big calm headline ("One brand, two ways to shop.") · lead
   [ Shop The Pooja Edit ]   Shop Thrift Store

Editorial image band (1 large rounded image → the piece)

Rail — "New in" (The Pooja Edit)          → All new pieces
Catalogue split (sand section)
   ┌───────────────┬───────────────┐
   │ image          │ image          │
   │ The Pooja Edit │ Thrift Store   │
   │ one line       │ one line       │
   │ View →         │ Browse →       │
   └───────────────┴───────────────┘
Rail — "From the Thrift Store"             → All pre-loved
Instagram strip (@poojadugar_)            → Follow
Newsletter
Footer
```

Two entrances above the fold on mobile: the hero's two CTAs; then reinforced by
the split and the two rails.

### 2.3 Listing / collection pages

Route pattern (matches the built app): `/the-pooja-edit`, `/the-pooja-edit/collections/<slug>`,
`/thrift`, `/thrift/collections/<slug>`.

```
Catalogue header
   H1 = catalogue or collection name
   one-line intro (per catalogue)
   [ mobile: "Filter & sort" button → bottom sheet ]
   [ desktop: inline Sort control + Filter rail ]

Sort:  Newest · Price low→high · Price high→low
       (thrift adds: "Available only" toggle)
Filters (from real data only):
   The Pooja Edit — Category, Size, Price range
   Thrift Store   — Category, Size (labelled size), Condition, Price range,
                    Availability (in stock / show sold)
Result grid — 2-col mobile · 3-col tablet · 4-col desktop
   "Load more" (keyset), then "That's everything."
No-results state — see UX findings
```

Catalog identity on listings: a small persistent chip/label in the header
("The Pooja Edit" / "Thrift Store · one-of-one"), the thrift-only "one of one"
card tag, and the thrift-only Condition filter + Availability toggle.

### 2.4 Product discovery flows

```
Instagram bio link ─► Homepage ─► hero CTA / rail ─► Listing ─► filter/sort ─► PDP
Instagram bio link ─► direct PDP link (deep link) ─► PDP ─► "More like this"
Search ─► results grid (both catalogs, catalog labelled per card) ─► PDP
Sold thrift PDP ─► "Similar pieces still available" rail ─► PDP
Mobile menu ─► catalog group ─► category ─► Listing ─► PDP
```

### 2.5 Cart / checkout / account

```
Bag (n) ─► Cart (full page, both catalogs grouped by catalogue,
                 per-line return-policy note, subtotal,
                 "Shipping & taxes calculated at checkout")
       ─► Checkout (guest by default)
            1 Contact + delivery address
            2 Delivery — shipping method + fee, COD eligibility
            3 Payment — Pay online (UPI/card/netbanking, Razorpay) OR Cash on delivery
            4 Review — line items, shipping, COD fee, tax, TOTAL  ► pay / place order
       ─► Razorpay hosted sheet  [EXTERNAL — labelled as a handoff]
       ─► Order confirmation (prepaid = "Payment received" / COD = "Order placed,
            pending confirmation") ─► Order & tracking page
Account (optional): orders, addresses, saved details. Never required to buy.
```

### 2.6 Route → screen map (for handoff)

| Screen | Route(s) in the built app |
| --- | --- |
| Home | `/` |
| The Pooja Edit listing | `/the-pooja-edit`, `?sort=` |
| Thrift listing | `/thrift`, `?sort=` |
| Collection | `/the-pooja-edit/collections/[slug]`, `/thrift/collections/[slug]` |
| Edit PDP | `/the-pooja-edit/[slug]` |
| Thrift PDP | `/thrift/[slug]` |
| Search | `/search`, `/search?q=` |
| Cart | `/cart` |
| Checkout | `/checkout` |
| Order + tracking | `/order/[orderNumber]` (guest: `?token=`) |
| Account | `/account`, `/account/orders`, `/account/addresses` |
| Policies | `/policies/shipping`, `/policies/returns-exchanges`, `/policies/privacy`, `/policies/terms`, `/size-guide` |
