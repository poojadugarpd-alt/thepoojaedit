# PoojaEdit — Handover Summary

Written 2026-09-16, refreshed 2026-10-07 late night (through D-151, `9fb1840`), for moving work to a different environment/tool (another
Claude Code session, Cursor, ChatGPT, a human dev, etc.). Everything here is
verifiable in this repo — treat it as a map, not a source of truth; re-check
against the actual files/`git log`/`docs/decisions.md` before relying on a
specific detail.

## 0. Start here (switching computers)

1. `git pull` on `main`. Everything from 2026-10-07 is on GitHub, including
   the UTM attribution work (D-136, merged the same evening).
2. Read §5–§8 below, then the bottom of `docs/decisions.md` (D-135 → D-140).
3. Local setup: `npm install`, `npm run db:dev` in one terminal, then
   `npm run check`, `npm run test:integration` and
   `npm run test:e2e:local -- --project=chromium` to confirm a clean baseline.
   **`.env.local` points at the remote dev Supabase project.** When creating a
   migration, override `DIRECT_URL`/`DATABASE_URL` with a local
   `postgresql://postgres:postgres@127.0.0.1:5433/<new db>` so
   `prisma migrate dev` never touches a remote database.
4. Facts that live in the `poojadugar` Mac's Claude notes, not in this repo:
   - Owner decisions are asked as pop-up multiple-choice questions, not long
     text lists.
   - The Instagram audit and experiment (6 Oct – 3 Nov, review 3 Nov) live in
     `~/Documents/Pooja Instagram/` on the `poojadugar` Mac; read its
     `HANDOFF.md`. Owner rule: Closet pieces sell only via `/closet`
     (dm2buy retired). Closet drops are created as DRAFT and published by hand
     at 8pm.
   - In Chrome, the Pooja profile (GitHub `poojadugarpd-alt`) is the one to
     use for this project.

## 1. What this is

**PoojaEdit** ("The Pooja Edit + Thrift Store") — a live, production
e-commerce site for a solo Instagram-led Indian fashion seller. One brand,
two catalogs: `THE_POOJA_EDIT` (new apparel) and `THRIFT` (one-of-one resale
pieces). Owner/operator: Pooja Dugar (real person, actively using the admin
panel daily). This is **not a demo or prototype — real customers place real
orders on it today.**

Repo: `~/Documents/PoojaEdit` (own git repo). GitHub: `poojadugarpd-alt/thepoojaedit`
(private). Push auth per Mac: on the `poojadugar` macOS account, `origin`
is SSH (`git@github.com:poojadugarpd-alt/thepoojaedit.git`) with
`~/.ssh/id_ed25519` added to GitHub as "PoojaEdit Mac" on 2026-10-07, so it
pushes directly. Check how the other Mac authenticates before relying on it
(it previously pushed `186fbab` successfully).

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
through **D-140**) — one row per decision with *what*, *when*, *why*. This is
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
| `decisions.md` | **The real changelog** — D-1 through D-140, read this |
| `acceptance-evidence.md` | AC-01..AC-18 status matrix |
| `release-candidate.md` | 8 launch blockers + status (most now closed, see §6) |
| `deferred-scope.md` | Explicitly out-of-scope items |
| `module-map.md`, `compatibility-plan.md` | Architecture reference |
| `integration-setup.md`, `supabase-setup.md`, `operations-runbook.md` | Provider setup + on-call/runbook |
| `admin-pwa-*.md` | The installable admin PWA + push notifications sub-effort |
| `plan-owner-requests-2026-10.md` | Plan + owner answers for D-137–D-140 (all shipped) |
| `briefs/pooja-website-agent-brief*.md` | Parked `/picks` + `/styling` brief and its assessment (§8, item 7) |

Project-scoped Claude Code tooling (commit `9328414`, 2026-09-21) lives in
`.claude/` + `.mcp.json`: context7 + Supabase (dev/staging, read-only) MCP
servers; a hook blocking raw `prisma migrate reset`/`db push`/`db execute`
outside the `npm run db:*` scripts; a format+typecheck-on-edit hook; skills
`log-decision`, `db-migration`, `structured-data-audit`, `llms-txt`; subagents
`money-safety-reviewer`, `e2e-unblocker`, `seo-aeo-reviewer`.

## 5. Current live state (as of `9fb1840`, 2026-10-07 late night)

`main` == `origin/main` == what's deployed. Vercel auto-deploys `main` to
Production and runs `prisma migrate deploy` first (`scripts/vercel-migrate.mjs`,
Production only).

**Infrastructure**
- **Live on `https://thepoojaedit.in`** since 2026-09-27 (D-131): GoDaddy
  `A @` → 216.198.79.1, `CNAME www` → Vercel; `www` 308s to the apex.
  `thepoojaedit.vercel.app` stays a live production alias, and the
  Razorpay/Shadowfax webhooks + Inngest app URL deliberately still point at it.
- Production runs `APP_ENV=production` with **Shadowfax's production token**
  (D-131) and **Razorpay LIVE keys** + a live webhook on `thepoojaedit.in`
  (D-134). Neither has a verified real transaction yet: the first real order
  is the proof for both.
- Old Shopify URLs 308 to their new-site equivalents (D-131). The two
  `untitled-jul…` handles go to TPE Set 1 White/Black (D-135).
- **Product images** are built at read time (`src/lib/storage-url.ts`). A
  cached Storage URL keeps its own object path and only gets the current
  project host. Don't trust `ProductImage.bucket/path` for rows from the
  Shopify import: their `bucket` is the placeholder `legacy-import`. Building
  from it broke every imported image for about 15 minutes on 2026-10-07; fixed
  in `1190569` (logged under D-135).

**Shipped 2026-10-07 (owner requests A–D; plan in `docs/plan-owner-requests-2026-10.md`)**
- **D-137 Shipping:** Label-only orders ship free; any Closet item makes the
  order ₹100, charged once. Decided in `computeQuote`; amounts in the
  `shipping.rules` setting (`fees.labelOnlyPaise` / `fees.withClosetPaise`).
- **D-138 Sold out switch:** `Product.markedSoldOut`. A checkbox under Status
  in the product editor. The product stays listed (sinks to the end, "Sold out"
  tag), can't be bought, and keeps its stock.
- **D-139 Closet sizes and quantity:** new Closet items start unticked
  "Only one piece (one of one)". Per-size measurements live in
  `ProductVariant.measurements`. Also fixed: unticking one of one and adding a
  size in one save used to be rejected.
- **D-140 Discount codes:** Admin → Discount codes (`/admin/discounts`).
  % or ₹ off; Label, Closet or both; minimum, dates, usage limit. Shoppers
  apply them at Review & pay. Uses are counted live (cancelled and abandoned
  unpaid orders don't count), and the code row is locked at placement.

**None of D-138–D-140's admin screens have been clicked by a human on the live
site yet.** Worth one quick try each (see §8, item 1).

**D-150 on production (checked 2026-10-07 night in the live admin):** the
2-minute `sweep-reservations` cron works. Abandoned order `PE-261007-ZCXN45`'s
holds were released as "expired" at 6:08 pm, two tees went back on sale and
both sweat shorts then sold to `PE-261007-CT28KP`. **Still unverified:**
Razorpay's `timeout` closing Checkout at hold end, and the `refund-late-capture`
Inngest function firing (no late double-buy has happened yet; the Inngest
dashboard isn't signed in on the Pooja Chrome profile). `PE-261007-ZCXN45` is a
real customer's unpaid order whose shorts are now sold: contact her or cancel it.

**Shipping outside Shadowfax (D-152, 2026-10-08):** order page → "Link
existing AWB" attaches a shipment booked on the Shadowfax360 dashboard or with
another courier. Non-Shadowfax shipments are `provider = "manual"`: set their
status with Mark shipped / Mark delivered. **Admin → Other courier (D-153)**
collects every paid order Shadowfax couldn't book, with a Delhivery-by-default
AWB box; the customer's AWB email carries Delhivery's tracking link.
`PE-261007-9W2XQ5` (Mumbai 400097, not served by Shadowfax) is waiting there.
The `TPJ-683BAADFB40D` "callback for an unknown shipment" task (16 Sept) is a
setup-era test callback; close it with a reason.

**Older, still true**
- Admin "Cancel order" works for `PROCESSING` orders with a booked but
  uncollected Shadowfax pickup (D-133). The real Shadowfax cancel API has
  never run (fake provider in tests only).
- Admin image uploads are compressed client-side (D-135).
- Local e2e: `npm run test:e2e:local` (`scripts/e2e-local.sh`) uses a fresh
  local Postgres DB + `DEV_ADMIN_AUTH=1`. CI runs Chromium only; WebKit isn't
  installed on the `poojadugar` Mac.

## 6. What's still open

1. **GST/tax/invoice config**: agreed values are legal name "The Pooja Edit",
   GSTIN `09ADWPD2873P1ZM` (Shadowfax profile, UP), supplier state Haryana (06),
   Gurugram pickup address (must not change). The owner has **not** let
   `business.profile` be saved yet, so invoices stay DRAFT-watermarked.
2. **Supabase Storage quota**: the org was over the Free-plan 1 GB. The dev
   project's Storage was emptied (D-132, ≈519 MB freed). Re-check usage
   before the grace period ends on **2026-10-23**.
3. **Dev Supabase migrations: done.** Checked 2026-10-07 night with
   `npm run db:migrate:status` (`.env.local` → `aws-0-ap-northeast-1`, the
   Tokyo dev project): all 10 migrations applied, "Database schema is up to
   date". Migrations still apply automatically only on Production deploys
   (`scripts/vercel-migrate.mjs`); apply new ones to dev by hand with
   `npm run db:migrate:deploy`.
   **Cleanup pending:** ~30 junk discount codes (`T` + 6 letters/digits,
   ₹200 off Closet, active) were created in that dev database on 2026-10-07
   night by an e2e run started outside `scripts/e2e-local.sh`. The owner is
   deleting them. Production is unaffected (only `POOJA10` there).
4. **npm audit (D-151): fixed for production dependencies.** CI now blocks on
   `npm audit --omit=dev --audit-level=high` (0 findings). The full audit
   still runs report-only: its only high finding is `braces` <=3.0.3 inside
   `eslint-config-next` → `fast-glob`, dev-only, with no fixed release yet.
   When `braces` (or a `@next/eslint-plugin-next` without `fast-glob` 3.3.1)
   ships a fix, upgrade and consider making the full audit blocking again.
5. **Shadowfax**: no self-serve label-download or COD-remittance API, so this
   needs their account manager.
6. **WhatsApp (Meta)**: deferred by the owner. Email (Resend) is live.
7. **Phase 13 operational drills**: backup/restore, rollback and budget
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
| 09-27 | D-133 | Cancel an order with a booked but uncollected Shadowfax pickup |
| 09-27 | D-134 | Razorpay LIVE keys + live webhook in Production |
| 10-07 | D-135 | Hardening deployed (merge `48c28bc`); same-day image regression fixed (`1190569`); "Product created." banner fix |
| 10-07 | D-136 | UTM attribution on orders (built 10-03, merged 10-07 with a cookie-encoding fix) |
| 10-07 | D-137 | Shipping: Label free, ₹100 once with any Closet item |
| 10-07 | D-138 | Sold out switch |
| 10-07 | D-139 | Closet sizes, quantity and per-size measurements |
| 10-07 | D-140 | Discount codes |
| 10-07 | D-141–D-148 | Other Mac: image-quota outage fix, photo ordering, sold-Closet archive, checkout credentials outage, required email + AWB email, test orders, new-order "cha-ching", unpaid checkouts hidden (see §8 item 0 and `decisions.md`) |
| 10-07 | D-149 | Product thumbnails on the admin order page |
| 10-07 | D-150 | Payment window = stock hold; late double-buy auto-refund; "On hold" label |
| 10-07 | (`2e280fc`) | Admin and order-page times shown in India time (were UTC, 5h30m early) |
| 10-07 | D-151 | Maintenance: vitest 4, Next 15.5.27, audit gate on prod deps, Prettier on all code |
| 10-08 | D-152 | Link existing AWB (Shadowfax360 or another courier, manual status); unconfirmed-PIN task |
| 10-08 | D-153 | Admin "Other courier" tab, Delhivery default, tracking link in AWB email |
| 10-08 | D-154 | Unpaid checkouts auto-cancelled after 30 min (no email); late payment on a cancelled order refunded |

Note on history: the other Mac pushed a backfill of D-131–D-133
(`186fbab`) that guessed D-131 = redirects only and D-132 = unknown. The
rows in `decisions.md` now are the original ones written on 2026-09-27; the
backfill was superseded in the 2026-10-07 merge.

## 8. What's planned / next up

0. **From 2026-10-07 evening (Closet drop + image outage):**
   - 24 one-of-one Closet pieces were added as **DRAFT** (owner publishes at
     8pm). Titles end in a colour where they would otherwise repeat.
   - **D-141:** Vercel image optimization hit its plan quota (402), blanking
     product photos; `images.unoptimized: true` now serves Supabase files
     directly (`cc7250a`, live, verified 200). Photos are now 0.5–2.7 MB
     each, so pages are heavy on mobile. Follow-up: shrink the Shopify-era
     originals, or upgrade Vercel and remove the flag.
   - **D-144:** checkout was broken on production (Shadowfax token and
     Razorpay live keys both rejected with 401). Owner replaced both; first
     live end-to-end order `PE-261007-QXQANN` proved Razorpay capture, invoice
     and a real Shadowfax shipment (AWB `SF40396589404`). That order is a
     test: cancel + refund it in admin, and archive "TEST ITEM - please ignore".
   - **D-143:** 42 sold Closet pieces archived via the new "Hide sold Closet
     pieces now" button (admin → Products → Sold). Going forward an hourly
     Inngest cron (`archive-sold-closet`) archives a Closet piece 3 days after
     it sells. **Unverified:** that Inngest has picked up the new function and
     the cron actually fires in production (no prod Inngest cron has been
     verified end-to-end yet; check the Inngest dashboard). Archived product
     URLs now return 404.
   - **Fixed (D-142):** multi-photo upload no longer makes the last photo
     primary; "Primary" moves the photo to the front without creating
     position ties; ↑/↓ work again (old ties heal on the next click);
     deleting the primary promotes the next photo. The buttons take ~5 s to
     show their result on production.

1. **Try the new admin features once on the live site** (needs an admin
   login): tick and untick Sold out on a product; create a Closet item with two
   sizes; create a discount code, apply it at live checkout without paying,
   then switch the code off.
2. **UTM attribution (D-136) is live** from 2026-10-07. Orders placed after
   a visit to a tagged link
   (`?utm_source=instagram&utm_medium=<bio|story|reel>&utm_campaign=…`) show
   "via source / medium / campaign" in the admin order header. Orders from
   before the release carry no source. Worth confirming once on the live
   site: open a tagged link, place (or start) an order, check the admin header.
   **Flaky test, investigated 2026-10-07 night, NOT fixed (owner wants to
   resume 2026-10-08):** `e2e/admin.spec.ts` "create a discount code in admin"
   fails ~10–40% of runs in isolation (also with `--workers=1`, in streaks;
   a full chromium suite run usually passes). Findings:
   - The server always creates the code and re-renders `/admin/discounts`
     in < 25 ms. The failure is client-side: Next's router never commits the
     action result. With today's `redirect("/admin/discounts")` (a redirect
     to the page you're on) the follow-up RSC fetch comes back tiny (~247 B)
     and the page body renders empty; with `return { ok: true }` instead, the
     button stays "Working…" forever. No console or page errors.
   - Ruled out, each by experiment: the admin service worker, `staleTimes`,
     `NewOrderAlert` polling, middleware, JS chunk loading, DB pool load.
     Playwright's `net::ERR_ABORTED` on action POSTs is noise (passing runs
     show it too). Next 15.5.27 didn't change the rate.
   - Product create (redirect to a new URL) flaked once on a cold server too
     ("Product created." not shown), so this may affect other admin actions.
   - Next steps: build a minimal page that reproduces it; try the latest
     Next 15.x / 16 on a branch; check the live admin by hand for a blank
     page after creating a code.
   - Only run e2e via `npm run test:e2e:local`. A plain `npx playwright test`
     or `npm run build` picks up `.env.local` (remote dev DB, real Supabase
     keys baked into the build).
3. **First real order** (test purchase): proves Razorpay live payment +
   signed webhook (D-134) and a real Shadowfax production shipment (D-131).
   Test order `PE-260911-BWFDHH` (staging AWB) can be cancelled.
4. **Save the GST `business.profile`** (§6.1) once the owner agrees.
5. **Supabase Storage quota** before 2026-10-23 (§6.2), and run the 3 new
   migrations on the dev project (§6.3).
6. **Fix `npm audit`** (§6.4).
7. **Website agent brief: parked.** `docs/briefs/pooja-website-agent-brief.md`
   (proposed `/picks` affiliate reviews + `/styling` service) was assessed on
   2026-10-07; the owner chose to keep the analysis and build nothing yet. Read
   `docs/briefs/pooja-website-agent-brief-ANALYSIS.md` first. If revived, the
   recommended order is UTM → `/styling` + private enquiry inbox → "Looks"
   (Shop this Reel, own products first) after the 3 Nov Instagram review →
   Picks reviews only once real reviews exist.
8. Optional tidy-up: move the Razorpay/Shadowfax webhooks and Inngest app URL
   from `thepoojaedit.vercel.app` to `thepoojaedit.in`.
9. **Remaining live verifications**: a real Shadowfax pickup cancel (D-133),
   a Shadowfax push-callback, an Inngest cron end-to-end, iPhone PWA install +
   push, and the prod signed-URL upload / private-bucket download (AC-12).
10. **Phase 13 operational drills**.
11. **Catalogue curation** (owner content work): thrift descriptions, SKUs,
    duplicate thrift listings, a size guide.
12. Deferred by the owner: WhatsApp (Meta Cloud API) and a customer `/account` area.

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
