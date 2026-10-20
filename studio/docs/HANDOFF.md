# Pooja Dugar Edit Studio — Handoff

_Last updated: 2026-10-20_

> **Moved 2026-10-20 (store D-171):** this site now lives in the store repo at `studio/`
> (`poojadugarpd-alt/thepoojaedit`, local `~/Documents/PoojaEdit/studio`). The old repo
> `vinayakch17/pooja-dugar-studio` is frozen at `bbf1adf`; don't commit there. Overview for all
> Pooja work: `../docs/ONE-ROOF.md`. Hosting and deploy are unchanged (Cloudflare, `npm run cf:deploy` from `studio/`).

## What this is
A one-page storefront for **Pooja Dugar's video editing & content service** (Instagram Reels, YouTube
long-form + Shorts, carousels, graphics). Services are sold like products: visitors add them to a bag
and check out over **WhatsApp** (pre-filled order message) or the **enquiry form**. There is no online
payment; that's deliberate, because the brief and timeline are agreed first.

Not to be confused with **PoojaEdit / thepoojaedit.in** (the fashion store), which is a different project.
This site used to deploy under PoojaEdit's Vercel team; it moved to Cloudflare on 2026-10-17, and the Vercel project was deleted the same day.

| | |
|---|---|
| Live site | **https://studio.thepoojaedit.in** (public address) |
| Origin | https://pooja-dugar-studio.vinayakch17.workers.dev (the real Worker; also reachable directly) |
| Repo | https://github.com/poojadugarpd-alt/thepoojaedit, folder `studio/` (since 2026-10-20; old repo vinayakch17/pooja-dugar-studio frozen) |
| Local path | `~/Documents/PoojaEdit/studio` |
| Hosting | **Cloudflare Workers**, account *Vinayakch17@gmail.com's Account* (`4950ef49…`), Worker **pooja-dugar-studio**, via OpenNext (`@opennextjs/cloudflare`) |
| Stack | Next.js 15 (App Router), React 19, TypeScript, plain CSS. No UI or animation libraries. |
| Contact data | WhatsApp +91 99715 72036 · poojadugar.pd@gmail.com · IG @poojadugar_ · YT @poojadugar |

## One roof: all Pooja work (added 2026-10-19)
From 2026-10-19, the studio site, The Pooja Edit store and PR outreach are handled in **one Claude chat**.
Each project keeps its own repo, handoff doc and deploy path. **Don't mix them.**

**Brand structure (owner's view, 2026-10-19).** The master brand is **Pooja Dugar**, the person. Five things sit under her:

```
Pooja Dugar (master brand)
├─ 1. Instagram @poojadugar_       PR outreach supports this
├─ 2. YouTube                      nothing built for it yet
├─ 3. thepoojaedit.in              store, Vercel, real customers
│    ├─ Label          new apparel                      live
│    ├─ Closet         one-of-one thrift, /closet       live
│    └─ Shop my Looks  /looks (store D-163)             built, hidden, no content
├─ 4. Styling Service  /styling on the store (D-162)    built, hidden, no content
└─ 5. Editing service  studio.thepoojaedit.in (this repo)  live
```

Shop my Looks and the Styling Service are built in the store's code but serve 404. The owner counts them as "not built" because they have no content yet; a page without content isn't worth launching. They are content work now, not dev work. Fill them in Admin → Looks and Admin → Styling, and only the owner presses Publish.

| | Studio (this repo) | The Pooja Edit store | PR outreach |
|---|---|---|---|
| What | Editing-service storefront | Fashion e-commerce (new + thrift), **real customers** | Brand PR forms and emails for @poojadugar_ |
| Live | studio.thepoojaedit.in | thepoojaedit.in | n/a |
| Local | `~/Documents/PoojaEdit/studio` | `~/Documents/PoojaEdit` | `~/.claude/skills/pr/SKILL.md` |
| GitHub | poojadugarpd-alt/thepoojaedit, `studio/` | poojadugarpd-alt/thepoojaedit (root) | n/a |
| Hosting | Cloudflare Workers (vinayakch17 account) | **Vercel** team `thepoojaedit` | Google Sheet "Pooja PR Forms" (poojadugar.pd@gmail.com) |
| Deploy | `npm run cf:deploy` | per its docs/HANDOVER.md | never submit or send; prefill only |
| Source of truth | `docs/HANDOFF.md` (this file) | `docs/HANDOVER.md` §8 on origin/main | the sheet |

Shared pieces and the rules for them:
- **Domain**: the `thepoojaedit.in` zone sits in Pooja's Cloudflare account. The store's records (apex, `www`, `img`, mail)
  point to Vercel. `studio.` is the only record that belongs to this site, through the forwarder Worker. Never edit the store's DNS records from studio work.
- **Brand**: the favicon "P" monogram is copied from the store's `src/app/` icons. WhatsApp +91 99715 72036 and IG @poojadugar_ are the same on both sites.
- **Two Macs**: the store is also worked on from the `poojadugar` Mac. Both projects share one repo now, so a single `git pull` in `~/Documents/PoojaEdit` covers both.
- **Cross-linking**: a store footer link to the studio, and one back, are not wanted yet (owner, 2026-10-19). Ask before adding them.
- **Risk**: the store is in production with real orders. Treat any change there as production work and follow its decision log (D-numbers).

## Prices (single source: `lib/site.ts`)
Reels ₹200 · YouTube long-form ₹1,000 (thumbnail + Shorts included) · Carousel ₹200 · Graphic ₹500.
Turnaround: 24–48h (reels/carousels/graphics), 2–3 days (YouTube). 1–2 revisions included. ₹200 Reels are
starter edits; premium Reels are quoted separately.

## Page structure (`app/page.tsx`)
Announcement bar → sticky header (logo, nav, WhatsApp, bag) → hero (3 IG Reel covers) → **Best sellers**
(4 service "products", add to bag) → **Reels love** row (IG Reels, hover-play) → YouTube split banner →
perks strip → **Shop by category** = the 5 capsule tabs (Instagram Reels / YouTube Long Form / Instagram
Carousels / Graphics / Chat With Us) → How it works → Reviews → footer.

Design reference: kyliecosmetics.com/en-in (owner asked for it on 2026-10-17). It replaced the
original dark "cinematic theater" design, which is still in git history at `e1fafb2`.
Tokens are at the top of `app/globals.css`: white bg, ink `#393939`, rose `#a06674`, blush `#f7eff1`,
Barlow Condensed (caps headlines) and Figtree (body).

## Where content comes from
| Content | Source | How to update |
|---|---|---|
| YouTube long-form + Shorts | **Live**: public RSS of the channel's `UULF…`/`UUSH…` playlists (latest 15 each), ISR hourly | Nothing to do. Set `YOUTUBE_API_KEY` for 50 items + durations + subscriber count |
| Instagram Reels (12 real) | `content/instagram.json` (manual) | Add entry: `permalink`, `caption`, `category` (brand/affiliate/ugc), `brand`, `thumbnailUrl` |
| Reel covers | `public/reels/<shortcode>.jpg` (self-hosted, ~120 KB each) | Download: `curl -sL "https://www.instagram.com/p/<code>/media/?size=l" -o public/reels/<code>.jpg`, then `sips -Z 960 -s formatOptions 78` |
| Reel hover videos | `public/reels/<shortcode>.mp4`, **auto-detected** (`lib/instagram.ts → localVideo`) | **None added yet.** Drop compressed mp4s named by shortcode |
| Carousels | **`content/canva.json`** (`kind: "carousel"`, 15 designs; "DAY @ IKEA" 4-page dropped as mixed content) → tiles open the design's **Canva public view link** in a new tab | Add a row + cover jpg in `public/canva/<id>.jpg`. Real IG carousels (non-sample) in `instagram.json` still show after them |
| Graphics | **`content/canva.json`** (`kind: "graphic"`, 5 designs) → open Canva view link | `content/graphics.json` samples only show if canva.json has no graphics |
| Testimonials | `content/testimonials.json` | Reviews section is **hidden** until at least one entry has no `sample: true` (owner choice 2026-10-19) |
| Category fixes | `content/instagram-overrides.json` keyed by shortcode | `{ "CODE": { "category": "ugc", "hidden": false } }` |

Instagram API path (optional): `INSTAGRAM_ACCESS_TOKEN` = long-lived token from *Instagram API with
Instagram Login*. It replaces the manual JSON and gives real mp4 previews. The token expires every 60 days.
The old Basic Display API is dead (Dec 2024).

## Behaviour notes
- **Bag** (`components/Bag.tsx`): localStorage `pd-bag-v1`. Checkout opens WhatsApp with the order summary.
  "Send as an email enquiry" switches to the Chat tab and pre-fills the form.
- **Hover-to-play** (`components/Media.tsx → useHoverPlay / VideoPreview`):
  - YouTube cards mount a muted, looping `youtube-nocookie` embed on hover or focus (140 ms delay) and remove it on leave.
  - IG Reels play from the local mp4 if one exists.
  - Touch screens: local mp4s play while on screen; YouTube does not preview on touch.
- **Enquiry form** → `POST /api/enquiry`: shared validation in `lib/enquiry.ts`, honeypot field `company`.
  It sends to Formspree `xzedobav` (live-tested 2026-10-17). It also supports Resend and a Google Sheets
  webhook. If none is configured it returns 503 and the UI falls back to WhatsApp.
- Deep links: `#reels`, `#youtube`, `#carousels`, `#graphics`, `#chat` switch tabs and scroll.

## How studio.thepoojaedit.in works (two Cloudflare accounts)
```
visitor → studio.thepoojaedit.in
        → Worker "studio-thepoojaedit"   (Pooja's CF account: poojadugar.pd@gmail.com, owns the thepoojaedit.in zone)
        → fetch https://pooja-dugar-studio.vinayakch17.workers.dev   (vinayakch17 CF account: the actual site)
```
- Cloudflare can only attach a custom domain to a Worker **in the same account as the zone**. The site lives in
  the vinayakch17 account and the zone is in Pooja's, so a 10-line forwarder Worker in Pooja's account serves the
  subdomain. It also rewrites any `Location` redirect back to studio.thepoojaedit.in.
- Forwarder code: edit it in Pooja's dashboard → Workers & Pages → `studio-thepoojaedit` → Edit code. Its only
  setting is `ORIGIN`. Custom domain: same Worker → Domains → `studio.thepoojaedit.in` (Production).
  Cloudflare created the DNS record and certificate automatically.
- **Normal deploys don't touch Pooja's account.** `npm run cf:deploy` updates the origin and the subdomain serves it
  immediately.
- The **store** (thepoojaedit.in, `www`, `img`, mail records) is untouched. It's still served by Vercel, with
  DNS in the same zone.
- If the site is ever moved into Pooja's account, delete the forwarder and attach the domain to that Worker directly.

## Environment (Cloudflare Worker `pooja-dugar-studio`)
| Var | Where | Status |
|---|---|---|
| `FORMSPREE_ENDPOINT` | Worker **secret** (`npx wrangler secret put FORMSPREE_ENDPOINT`) | ✅ `https://formspree.io/f/xzedobav`, live-tested on Cloudflare 2026-10-17 |
| `NEXT_PUBLIC_SITE_URL` | `.env.production` (committed; inlined at build) | ✅ `https://studio.thepoojaedit.in` (canonical + OG URLs) |
| `INSTAGRAM_ACCESS_TOKEN`, `YOUTUBE_API_KEY`, `RESEND_API_KEY` | would be Worker secrets | not set (optional) |

Bindings (`wrangler.jsonc`):
- `NEXT_INC_CACHE_KV`: KV namespace `pooja-dugar-studio-cache` (`410a3ae7…`), the ISR/fetch cache.
- `WORKER_SELF_REFERENCE`: the Worker itself, used by the memory queue for background revalidation.
- `ASSETS`: static files.

Cache config: `open-next.config.ts` uses the KV incremental cache and the memory queue. The home page is ISR (1 h):
it is served from KV (`x-nextjs-cache: HIT`) and refreshes YouTube data in the background.

## Deploy
```bash
cd ~/Documents/PoojaEdit && git pull && cd studio
npm ci                     # first time on a machine; studio has its own node_modules
npm run cf:deploy          # opennextjs-cloudflare build && deploy → origin Worker; live at studio.thepoojaedit.in
npm run cf:preview         # build + run locally in the Workers runtime (wrangler dev)
```
- `npm run build` runs `scripts/reel-videos.mjs` first (prebuild). It lists `public/reels/*.mp4` into
  `content/reel-videos.json`, because Workers have no filesystem at runtime.
- Wrangler is logged in as vinayakch17@gmail.com (single account). Check with `npx wrangler whoami`.
- GitHub isn't connected to Cloudflare; deploys are manual. Pushing to `main` deploys only the **store** (Vercel);
  `vercel.json` skips the Vercel build when a push changes nothing outside `studio/`.
- The store's tsconfig/ESLint/Prettier/Tailwind ignore `studio/`; `next.config.mjs` pins `outputFileTracingRoot` to this folder.

## Testing tips
- `npm run dev`, or `npm run build && npm start`.
- The Claude-in-Chrome browser can't reach this Mac's localhost. Use local headless Chrome:
  - Use `--force-prefers-reduced-motion` for screenshots, otherwise animations get frozen mid-way.
  - For hover tests, drive it over CDP (`--remote-debugging-port`).

## Canva designs (2026-10-19)
- Source account: Canva **M K JAIN (urbandeconsindia@gmail.com)**, signed in on the Chrome that Claude-in-Chrome drives (Pooja's machine).
- Owner approved all designs via the check-in artifact https://claude.ai/artifact/DDsHpyQCEy7ukx6JANZX1P (answers in its db: `designs`, `settings/site`).
- Each design got a **view-only public link** (Share → Public view link → canva.link/…). Revoke from the same panel to unpublish.
- Covers: screenshots of `<view-url>?embed` in local headless Chrome, cropped to the design, ~900px JPG. Video designs (c11, c13, c14) sit behind a Cloudflare check for headless, so their covers were captured from the real Chrome instead.
- Not included: "June Lookbook bestsellers" (owned by House Of Chikankari, view-only for this account).
- 2026-10-19: owned designs with an "Anyone with the link: can edit" link were switched to **can view** (Malvin carousel, Frames). Two designs owned by OTHER accounts (THE CURSED JUNGLE, NO SMALL TALK) were left on can edit, because switching would remove this account's own edit access.

## SEO pages (2026-10-20, D-174)
- `/reels`, `/youtube`, `/carousels`, `/graphics`: one page per service (`app/[service]/page.tsx`, copy in
  `lib/services.ts`, prices still from `lib/site.ts`). Linked **from the footer only** (owner); the header and tabs
  are unchanged. Each has its own title/description, an answer-first intro, real samples, FAQ and Service +
  FAQPage + BreadcrumbList JSON-LD.
- Home: search words under the hero line, "brands i've edited for" row (built from the `brand` field of the Reels
  in `content/instagram.json`, so it only lists brands tagged in real public Reels), "who edits your videos",
  and an FAQ (`#faq`).
- `components/Footer.tsx` is shared; it links back to the shop (Label, Closet, Personal styling, About).
- `app/sitemap.ts`, `app/robots.ts` (all crawlers, AI included; `/api/` disallowed), `public/llms.txt`,
  `app/opengraph-image.jpg` (1200×630, made from three Reel covers).
- Schema: `lib/schema.ts`. Pooja is the same Person `@id` as on thepoojaedit.in (`https://thepoojaedit.in#pooja-dugar`).
- Google Search Console: covered by the `sc-domain:thepoojaedit.in` property (Pooja's Google account). Bing: add
  `studio.thepoojaedit.in` and its sitemap there (not done yet).

## Open items / next steps
1. **Reel mp4s** for hover-play (export from IG or originals; compress; ffmpeg isn't installed on this Mac).
2. ~~Real carousels and graphics~~ done via Canva links (2026-10-19).
3. **Real testimonials**: add to `content/testimonials.json` without `sample` and the Reviews section reappears.
4. Confirm the "best seller" / "new" badges in `lib/products.ts` are true.
5. Optional: link the two sites (a "content editing services" link in the store footer and a link back);
   Workers Builds for auto-deploy; Instagram token; YouTube API key.

## History
| Commit | Change |
|---|---|
| `e1fafb2` | Initial dark cinematic portfolio + enquiry form |
| `5eb7440` | Restyled as a Kylie-style storefront with bag + WhatsApp checkout |
| `9f7a4b6` | 12 real IG Reels with self-hosted covers |
| `bfaae08` | Hover-to-play; Instagram areas use Instagram imagery only |
| `8c3b718` | Moved from Vercel to Cloudflare Workers (OpenNext, KV cache) |
| `1eaf20f` | Live at studio.thepoojaedit.in via forwarder Worker in Pooja's CF account |
| `e832c4c` | Favicon = The Pooja Edit's 'P' monogram (copied from PoojaEdit `src/app/` icon files) |
