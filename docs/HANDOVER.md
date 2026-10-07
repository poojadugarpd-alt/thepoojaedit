# PoojaEdit — Handover Summary

Written 2026-09-16, refreshed 2026-10-07 (D-135 merge), for moving work to a different environment/tool (another
Claude Code session, Cursor, ChatGPT, a human dev, etc.). Everything here is
verifiable in this repo — treat it as a map, not a source of truth; re-check
against the actual files/`git log`/`docs/decisions.md` before relying on a
specific detail.

## 1. What this is

**PoojaEdit** ("The Pooja Edit + Thrift Store") — a live, production
e-commerce site for a solo Instagram-led Indian fashion seller. One brand,
two catalogs: `THE_POOJA_EDIT` (new apparel) and `THRIFT` (one-of-one resale
pieces). Owner/operator: Pooja Dugar (real person, actively using the admin
panel daily). This is **not a demo or prototype — real customers place real
orders on it today.**

Repo: `~/Documents/PoojaEdit` (own git repo). GitHub: `poojadugarpd-alt/thepoojaedit`
(private). Push auth differs per Mac: on the `poojadugar` macOS account
neither SSH (`~/.ssh/id_ed25519`) nor HTTPS is authorised yet, so commits from
there have gone up via GitHub's web upload.

Live production URL: **`https://thepoojaedit.in`** (Vercel, since the D-131
cutover; `https://thepoojaedit.vercel.app` remains a working alias).

## 2. Stack (fixed by `docs/01-master-specification.md`, do not casually change)

Next.js 15.5.x App Router + React 19 + Node **22.x** (pinned — `engines`,
`.nvmrc`, Vercel Project Settings all agree; something drifted to 24.x once,
was fixed) · Tailwind v4 + shadcn/ui · **Prisma 7** (`@prisma/adapter-pg`;
`prisma@latest` resolves to a v8 RC — always pin 7 explicitly) · Supabase
(Postgres + Auth + Storage) · Razorpay (payments) · Shadowfax (last-mile
shipping — replaced Shiprocket early on, see D-59) · Inngest (background
jobs/crons) + a transactional-outbox pattern · Resend (email) + WhatsApp
Cloud API (deferred, see §6) · Sentry + Pino. **npm**, not pnpm.

Two Supabase projects:
- **Production**: `poojaedit-prod`, ref `fizwboogbaeximscatsk`, ap-south-1 (Mumbai).
- **Dev/staging**: the original `poojaedit` project, ref `rewfxtqhuvyfsbteyvvm`, ap-northeast-1 (Tokyo). Vercel Preview/Development point here.

## 3. How this was built — read before changing workflow

Driven by two owner-supplied docs: `docs/01-master-specification.md`
(architecture, stable) and `docs/02-execution-playbook.md` (the original
14-phase build plan, 0–13). All 14 phases are done; the project is now in
**ongoing post-launch operation** — owner reports a bug or asks for a
feature, it gets diagnosed/built/verified in one pass, logged, shipped.

**Every non-trivial decision is logged in `docs/decisions.md`** (currently
through **D-135**) — one row per decision with *what*, *when*, *why*. This is
the single best file to skim for real history; it's more reliable than this
handover doc for anything past 2026-10-07. `docs/build-progress.md` covers
the original phase-by-phase build (stops at Phase 12 — later work lives in
`decisions.md` instead, not backfilled there).

Working norms observed throughout, worth continuing:
- Verify claims against real evidence (real Postgres integration tests, real
  browser checks, real deploy checks) — not assumed passing.
- One additive migration per real schema need; never `prisma db push`/`reset`
  against data that matters; expand→backfill→validate→switch→contract.
- `npm run verify` = lint + typecheck + unit + build + integration (real PG)
  + e2e + `npm audit`. Run before calling anything done.
- No redesign without being asked — [[feedback-ui-ux-incremental-only]] does
  NOT apply here (a Rhode-style redesign was explicitly requested and done),
  but incremental fixes stay incremental.
- Money/inventory correctness gets extra scrutiny (see §9's real bugs found).

## 4. Docs map (`docs/`)

| File | Purpose |
| --- | --- |
| `01-master-specification.md` | Fixed architecture/spec |
| `02-execution-playbook.md` | Original 14-phase build plan (historical) |
| `build-progress.md` | Phase-by-phase build log through Phase 12 |
| `decisions.md` | **The real changelog** — D-1 through D-135+, read this |
| `acceptance-evidence.md` | AC-01..AC-18 status matrix |
| `release-candidate.md` | 8 launch blockers + status (most now closed, see §6) |
| `deferred-scope.md` | Explicitly out-of-scope items |
| `module-map.md`, `compatibility-plan.md` | Architecture reference |
| `integration-setup.md`, `supabase-setup.md`, `operations-runbook.md` | Provider setup + on-call/runbook |
| `admin-pwa-*.md` | The installable admin PWA + push notifications sub-effort |

Project-scoped Claude Code tooling (commit `9328414`, 2026-09-21) lives in
`.claude/` + `.mcp.json`: context7 + Supabase (dev/staging, read-only) MCP
servers; a hook blocking raw `prisma migrate reset`/`db push`/`db execute`
outside the `npm run db:*` scripts; a format+typecheck-on-edit hook; skills
`log-decision`, `db-migration`, `structured-data-audit`, `llms-txt`; subagents
`money-safety-reviewer`, `e2e-unblocker`, `seo-aeo-reviewer`.

## 5. Current live state (as of the D-135 merge, 2026-10-07)

- **Live on `https://thepoojaedit.in`** since 2026-09-27 (D-131): GoDaddy
  `A @` → 216.198.79.1, `CNAME www` → Vercel; `www` 308s to the apex.
  `thepoojaedit.vercel.app` stays a live production alias, and the
  Razorpay/Shadowfax webhooks + Inngest app URL deliberately still point at it.
- Production runs `APP_ENV=production` (`NEXT_PUBLIC_APP_ENV=preview` is now
  scoped to Pre-Production only) with **Shadowfax's production token** (D-131)
  and **Razorpay LIVE keys** + a live webhook on `thepoojaedit.in` (D-134).
  Neither has a verified real transaction yet: the first real order is the
  proof for both.
- Old Shopify URLs 308 to their new-site equivalents (D-131). The two
  `untitled-jul…` handles go to TPE Set 1 White/Black (corrected in D-135).
- Product images: 458 `ProductImage.publicUrl` rows that still pointed at the
  dev project were repointed at prod after a ~20-minute outage (D-132). Since
  D-135 image URLs are built at read time from `bucket`/`path`
  (`src/lib/storage-url.ts`), so a project move can't strand them again.
- Admin "Cancel order" works for `PROCESSING` orders with a booked-but-not-
  collected Shadowfax pickup: it cancels the pickup first, then the order
  (D-133). The UI button for this was only added in D-135. The real Shadowfax
  cancel API has never been exercised (fake provider in tests only).
- Admin image uploads are compressed client-side (≤2400px, JPEG q0.85, D-135).
- Local e2e works again: `npm run test:e2e:local` (`scripts/e2e-local.sh`)
  uses a fresh local Postgres DB + `DEV_ADMIN_AUTH=1` (D-135).
- Storefront, checkout (Razorpay prepaid; COD off, D-90), order tracking,
  invoices, refunds/returns and the admin dashboard are live. The admin product
  editor (D-121–D-125) and the admin PWA push still haven't been walked
  through end-to-end by a human.

## 6. What's still open (from `docs/release-candidate.md`'s 8 blockers)

Domain cutover and the Shadowfax production token are done (D-131). Still open:
1. **GST/tax/invoice config**: agreed values are legal name "The Pooja Edit",
   GSTIN `09ADWPD2873P1ZM` (Shadowfax profile, UP), supplier state Haryana (06),
   Gurugram pickup address (must not change). The owner has **not** let
   `business.profile` be saved yet, so invoices stay DRAFT-watermarked.
2. **Supabase Storage quota**: the org was over the Free-plan 1 GB. The dev
   project's Storage was emptied (D-132, ≈519 MB freed). Re-check usage
   before the grace period ends on **2026-10-23**.
3. **Shadowfax**: no self-serve label-download or COD-remittance API, so this
   needs their account manager.
4. **WhatsApp (Meta)**: deferred by the owner. Email (Resend) is live.
5. **Phase 13 operational drills**: backup/restore, rollback and budget
   alerts are not done.

## 7. What we worked on most recently (2026-09-15 → 2026-10-07)

Full detail in `docs/decisions.md`.

| When | Decision | What |
| --- | --- | --- |
| 09-15 | D-121, D-122 | Single-page admin product editor; real measurements form |
| 09-16 | D-123–D-127 | Quantity-picker fixes, stuck new-product recovery, Label ↔ Closet move |
| 09-21 | D-128–D-130 | SEO/AEO/GEO JSON-LD, `llms.txt`, policy copy + FAQ JSON-LD |
| 09-27 | D-131 | Domain cutover to Vercel, prod `APP_ENV`, Shadowfax prod token, legacy-URL redirects |
| 09-27 | D-132 | Image outage after emptying dev Storage; `publicUrl` repointed to prod |
| 09-27 | D-133 | Cancel an order with a booked-but-not-collected Shadowfax pickup |
| 09-27 | D-134 | Razorpay LIVE keys + live webhook in Production |
| 09-27 | D-135 | Hardening: read-time image URLs, upload compression, local e2e, TPE Set 1 redirects, Cancel button for `PROCESSING` |

Note on history: the other Mac pushed a backfill of D-131–D-133
(`186fbab`) that guessed D-131 = redirects only and D-132 = unknown. The
rows in `decisions.md` now are the original ones written on 2026-09-27; the
backfill was superseded in the 2026-10-07 merge.

## 8. What's planned / next up

**Owner feature requests (added 2026-10-07, not started):**

- **A. Discount code at checkout.** A field where the customer enters a code
  and gets a discount. Nothing exists yet. `deferred-scope.md` lists
  "promotions / coupons" as not built, but orders already store per-line
  discount allocations (`OrderItem`), so the order and invoice side has a
  place for it. Needs admin to create codes (amount or %, expiry, usage limit).
- **B. Size and quantity on Pooja's Closet items.** Closet (`THRIFT`)
  products are one-of-one by default (`isOneOfOne`), and a one-of-one with
  more than one variant is blocked in the editor. The owner wants to set size
  and stock quantity on closet pieces, like Label products.
- **C. Mark a product "Sold out" by hand and keep it on the page.** Products
  with zero stock already stay listed and sink to the end (owner request,
  2026-09-14, `listPublishedProducts`). What's missing is an admin switch to
  mark a product sold out without editing stock, so it shows "Sold out" and
  can't be bought.
- **D. Fixed ₹100 shipping on Pooja's Closet items.** Still to confirm with
  the owner: ₹100 per closet item, or ₹100 once per order that has closet
  items? Also what applies to Label items in a mixed cart. The current
  shipping quote (`src/server/shipping/`) is per order, not per catalog.

1. **First real order** (test purchase): proves Razorpay live payment +
   signed webhook (D-134) and a real Shadowfax production shipment (D-131).
   Test order `PE-260911-BWFDHH` (staging AWB) can be cancelled now that
   D-135 is deployed.
2. **Save the GST `business.profile`** (§6.1) once the owner agrees, so
   invoices leave DRAFT. Then legal name/GST can go into `llms.txt` and the
   `Organization` JSON-LD (held back in D-128).
3. **Supabase Storage quota** before 2026-10-23 (§6.2).
4. **UTM attribution (D-136)**: done on branch `utm-attribution` (worktree
   `~/Documents/PoojaEdit-utm`, commit `734f392`). Not merged or deployed.
   It needs a rebase onto this merge (its `decisions.md` row will conflict).
5. Optional tidy-up: move the Razorpay/Shadowfax webhooks and Inngest app URL
   from `thepoojaedit.vercel.app` to `thepoojaedit.in`.
6. **Owner live walkthrough of the admin product editor**, and delete the
   stuck "Mango Satin Skirt - waist 26" product if it's still there.
7. **Remaining live verifications**: a real Shadowfax pickup cancel (D-133),
   a Shadowfax push-callback, an Inngest cron end-to-end, iPhone PWA install +
   push, and the prod signed-URL upload / private-bucket download (AC-12).
8. **Phase 13 operational drills**.
9. **Catalogue curation** (owner content work): thrift descriptions, SKUs,
   duplicate thrift listings, a size guide.
10. Deferred by the owner: WhatsApp (Meta Cloud API) and a customer `/account` area.

## 9. Real production incidents fixed so far (patterns worth knowing)

A recurring class of bug: **a fix verified against local Postgres/fakes but
not re-verified against the actual live Supabase project or actual live
Vercel env vars.** Concretely: a migration pushed but never `deploy`ed to
prod (D-111, fixed by D-112's auto-migrate-on-deploy script); a Storage RLS
function missing `SECURITY DEFINER` so real authenticated writes 403'd even
though service-role writes worked fine (D-113); a Vercel env var's *Value*
field accidentally holding the wrong secret while the right one sat in the
*Note* field (D-120). **Lesson carried forward: after any fix, re-verify
against the actual live production URL/database/env vars, not just the local
equivalent.** Two direct money-adjacent bugs also found and fixed live:
a paise-vs-rupees mislabeled price input that could 100x an actual price
(D-117), and product images silently not rendering because `publicUrl` was
never set on admin-uploaded images (D-117, same architectural gap flagged
and deferred earlier in D-110).

## 10. Env vars (names only — real values live in `.env.local` / Vercel, never commit them)

`DATABASE_URL`, `DIRECT_URL`, `SHADOW_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STORAGE_PUBLIC_URL`, `SUPABASE_SECRET_KEY`,
`NEXT_PUBLIC_SITE_URL`, `ADMIN_BOOTSTRAP_TOKEN`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHADOWFAX_API_BASE`,
`SHADOWFAX_API_TOKEN`, `SHADOWFAX_WEBHOOK_TOKEN`, `EMAIL_FROM`,
`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`,
`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SENTRY_DSN`, `LOG_LEVEL`,
`BEHOLD_FEED_ID`. Full annotated list with setup notes: `.env.example`.

## 11. Housekeeping noticed, not acted on

An untracked file `products_export_1 (1).csv` sits in the repo root (the
legacy Shopify export). D-135 checked it: all 27 products are already on the
site, so nothing is left to import. Move it under the gitignored `migration/`
tree or delete it.

## 12. Where to actually start in a new environment

1. Read `docs/decisions.md` from the bottom up for the real recent history.
2. Read `docs/release-candidate.md` §5 for exactly what's blocking full launch.
3. `npm install && npm run db:dev` (local embedded Postgres, no Docker
   needed) to get a working dev environment; `.env.local` already has the
   dev/staging Supabase project wired if you're continuing in this same
   machine — copy it rather than reconstructing from `.env.example` if you
   have access to it.
4. Run `npm run check` to confirm a clean baseline before changing anything.
