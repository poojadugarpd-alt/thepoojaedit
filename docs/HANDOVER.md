# PoojaEdit — Handover Summary

Written 2026-09-16, refreshed 2026-09-28 (as of commit `5f2479a`), for moving work to a different environment/tool (another
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
(private). Local `origin` auth is a fine-grained PAT in the macOS keychain.

Live production URL: **`https://thepoojaedit.vercel.app`**. The real domain
`thepoojaedit.in` still points at the owner's old Shopify store on purpose —
DNS cutover is a deliberate later step, not yet done (see §6).

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
through **D-133**) — one row per decision with *what*, *when*, *why*. This is
the single best file to skim for real history; it's more reliable than this
handover doc for anything past 2026-09-28. `docs/build-progress.md` covers
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
| `decisions.md` | **The real changelog** — D-1 through D-133+, read this |
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

## 5. Current live state (as of commit `5f2479a`, 2026-09-27; re-checked 2026-09-28)

- `main` == `origin/main`; Vercel auto-deploys `main` to Production. The
  latest SEO work is confirmed live (`/llms.txt` 200, `FAQPage` JSON-LD on
  `/policies/shipping`, checked 2026-09-28).
- Admin "Cancel order" now also works after a Shadowfax pickup has been
  booked but not yet collected — it cancels the pickup with Shadowfax first,
  then the order, restoring stock once (D-133, 2026-09-27). Refused once the
  parcel has been picked up.
- Old Shopify URLs (`/products/…`, `/collections/…`, `/pages/…`,
  `/policies/…`, `/blogs/…`, `/account`) 308-redirect to their new-site
  equivalents (commit `72015b1`, live — `/collections/all` → `/label` checked
  2026-09-28), ready for the domain cutover.
- Storefront + checkout (Razorpay prepaid; COD turned off at checkout, D-90) +
  order tracking + invoices + refunds/returns + admin dashboard are all live
  and used for real.
- Admin product editor: rebuilt as one Shopify-style page (D-121), with a real
  measurements form (D-122), partial-save recovery fixed (D-124), and products
  can now be moved between the Label and the Closet (D-125). **Still not walked
  through live by a human end-to-end** — the owner should create/edit one
  product of each catalog before trusting it fully.
- Admin PWA (installable, push notifications) shipped 2026-09-12 — real
  iPhone install/push delivery still unverified end-to-end.
- Local admin e2e tests are currently broken (not a real bug): `DEV_ADMIN_AUTH`
  bypass only activates when Supabase is *unconfigured*, and `.env.local` has
  had a real Supabase project since the D-115 cutover. Needs a real test-admin
  auth path for e2e to work locally again (the `e2e-unblocker` subagent was
  written for exactly this) — unresolved, not yet prioritized.

## 6. What's still open (from `docs/release-candidate.md`'s 8 blockers)

Most are done. Still open:
1. **Domain cutover** — `thepoojaedit.in` → Vercel. Currently deliberately still
   pointing at the owner's old Shopify store; a real go-live step, not a bug.
2. **`NEXT_PUBLIC_APP_ENV=preview`** is still set even on Production (overrides
   `VERCEL_ENV`) — flipping it to `production` is blocked on Shadowfax's
   *production* API token not existing yet (only the staging token is wired);
   flipping early would break live shipment creation.
3. **Shadowfax**: staging shipments proven live; no self-serve label-download
   or COD-remittance API — needs their account manager; production token
   still missing.
4. **Owner-confirmed GST/tax/invoice config** — GSTIN, HSN rates, legal name —
   still outstanding, so invoices stay DRAFT-watermarked.
5. **WhatsApp (Meta)** — explicitly deferred by the owner (cost, pre-revenue);
   email (Resend) is verified and live instead.
6. **Phase 13 operational drills** — backup/restore rehearsal, budget alerts,
   rollback rehearsal — not yet done in an isolated environment.

## 7. What we worked on most recently (2026-09-15 → 2026-09-27)

All shipped and live unless noted. Full detail in `docs/decisions.md`.

| When | Decision | What |
| --- | --- | --- |
| 09-15 | D-121 | Admin product editor rebuilt as a single Shopify-style page |
| 09-15 | D-122 | Raw-JSON "measurements" textarea replaced with a real form (owner complaint) |
| 09-16 | D-123 | Storefront quantity-picker bug ("jumped to 9") — first fix |
| 09-16 | D-124 | New-product screen could get permanently stuck after a partial save (SKU unique-constraint + catalog desync) |
| 09-16 | D-125 | Move an existing product between Label ↔ Closet instead of delete-and-recreate |
| 09-16 | D-126, D-127 | Quantity input kept appending digits — fixed on focus, then per keystroke (PDP only; `/cart` deliberately left allowing 2 digits) |
| 09-21 | — (`9328414`) | Project-scoped Claude Code tooling (see §4) |
| 09-21 | D-128 | SEO/AEO/GEO pass: `Organization`/`WebSite` + `BreadcrumbList` JSON-LD, `public/llms.txt` |
| 09-21 | D-129 | Policy copy reconciled with the owner (incl. stale COD line in terms); `FAQPage` JSON-LD on `/policies/shipping` |
| 09-21 | D-130 | Owner confirmed refunds = 14 days from return request; `FAQPage` JSON-LD on `/policies/returns-exchanges` |
| 09-27 | — (`72015b1`) | 308 redirects from legacy Shopify URLs, ahead of the `thepoojaedit.in` cutover |
| 09-27 | D-133 (`d01938a`→`5f2479a`) | Cancel an order whose Shadowfax pickup is booked but not yet collected (cancels the pickup first; integration-tested) |

D-131–D-133 were backfilled into `docs/decisions.md` on 2026-09-28 (the
09-27 work was done on another machine and not logged at the time). D-132 has
no known content — kept as a placeholder row.

## 8. What's planned / next up

Rough priority order. Items 1–4 need the owner or a third party; 5+ can be
picked up by a developer directly.

1. **Owner GST/tax/legal config** (GSTIN, HSN + GST rates, registered legal
   name/address) → invoices and policy pages leave DRAFT. Biggest real
   launch blocker. Once done, the legal name/GST can also go into
   `llms.txt` and the `Organization` JSON-LD (deliberately held back, D-128).
2. **Shadowfax production API token** + ask their account manager about label
   download and COD remittance (no self-serve API) → then flip
   `NEXT_PUBLIC_APP_ENV` from `preview` to `production`.
3. **Domain cutover** `thepoojaedit.in` → Vercel (retire the old Shopify
   store). Legacy-URL redirects are already in place (`72015b1`). After cutover: update `NEXT_PUBLIC_SITE_URL`, canonical/sitemap
   URLs, Razorpay/Shadowfax/Resend webhook URLs, and Inngest sync target.
4. **Owner live walkthrough of the admin product editor** (§5) — and delete +
   recreate the stuck "Mango Satin Skirt - waist 26" Label product left over
   from before D-124's fix, if she hasn't already (check `/admin/products`).
5. **Fix local admin e2e auth** (§5) so `npm run verify` is fully green locally.
6. **Phase 13 operational drills** — backup/restore rehearsal, rollback
   rehearsal, budget alerts, in an isolated environment.
7. **Remaining live verifications**: a real Shadowfax pickup cancel (D-133,
   only tested against a fake), every legacy Shopify product URL resolving
   (D-131), a real Shadowfax push-callback, a real
   Inngest cron firing end-to-end, iPhone PWA install + push delivery,
   signed-URL upload / private-bucket download against the prod project
   (AC-12 remainder), Supabase Free-tier pause/backup check.
8. **Catalogue curation** (owner content work): thrift items with no
   descriptions, missing SKUs, duplicate thrift listings, a real size guide.
9. **Decide on the stray `products_export_1 (1).csv`** in the repo root (§11).
10. Deferred by the owner, not planned: **WhatsApp (Meta Cloud API)**, and a
    customer `/account` area (guest checkout only by design for now).

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
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
`NEXT_PUBLIC_SITE_URL`, `ADMIN_BOOTSTRAP_TOKEN`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SHADOWFAX_API_BASE`,
`SHADOWFAX_API_TOKEN`, `SHADOWFAX_WEBHOOK_TOKEN`, `EMAIL_FROM`,
`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`,
`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SENTRY_DSN`, `LOG_LEVEL`,
`BEHOLD_FEED_ID`. Full annotated list with setup notes: `.env.example`.

## 11. Housekeeping noticed, not acted on

An untracked file `products_export_1 (1).csv` sits in the repo root (a
legacy Shopify export, not gitignored, not staged). Harmless as-is; decide
whether to move it under the already-gitignored `migration/` tree or delete
it once you confirm it's not needed.

## 12. Where to actually start in a new environment

1. Read `docs/decisions.md` from the bottom up for the real recent history.
2. Read `docs/release-candidate.md` §5 for exactly what's blocking full launch.
3. `npm install && npm run db:dev` (local embedded Postgres, no Docker
   needed) to get a working dev environment; `.env.local` already has the
   dev/staging Supabase project wired if you're continuing in this same
   machine — copy it rather than reconstructing from `.env.example` if you
   have access to it.
4. Run `npm run check` to confirm a clean baseline before changing anything.
