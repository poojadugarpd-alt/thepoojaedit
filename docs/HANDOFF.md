# Pooja Dugar Edit Studio — Handoff

_Last updated: 2026-10-17_

## What this is
A one-page storefront for **Pooja Dugar's video editing & content service** (Instagram Reels, YouTube
long-form + Shorts, carousels, graphics). Services are sold like products: visitors add them to a bag
and check out over **WhatsApp** (pre-filled order message) or the **enquiry form**. There is no online
payment; that's deliberate, because the brief and timeline are agreed first.

Not to be confused with **PoojaEdit / thepoojaedit.in** (the fashion store), which is a different project.
This site used to deploy under PoojaEdit's Vercel team; it moved to Cloudflare on 2026-10-17.

| | |
|---|---|
| Live site | **https://pooja-dugar-studio.vinayakch17.workers.dev** (Cloudflare Workers) |
| Old site | https://pooja-dugar-studio.vercel.app: Vercel project still running until it's deleted (see Open items) |
| Repo | https://github.com/vinayakch17/pooja-dugar-studio (private) |
| Local path | `~/Documents/pooja-dugar-studio` |
| Hosting | **Cloudflare Workers**, account *Vinayakch17@gmail.com's Account* (`4950ef49…`), Worker **pooja-dugar-studio**, via OpenNext (`@opennextjs/cloudflare`) |
| Stack | Next.js 15 (App Router), React 19, TypeScript, plain CSS. No UI or animation libraries. |
| Contact data | WhatsApp +91 99715 72036 · poojadugar.pd@gmail.com · IG @poojadugar_ · YT @poojadugar |

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
| Carousels | `content/instagram.json` (`kind: "carousel"`) | **Still 4 sample tiles**, waiting for real post links |
| Graphics | `content/graphics.json` + `public/graphics/` | **Still 8 sample tiles**, waiting for image files |
| Testimonials | `content/testimonials.json` | **Placeholders** (labelled on page, but shown with ★★★★★). Replace or remove before promoting the site |
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

## Environment (Cloudflare Worker `pooja-dugar-studio`)
| Var | Where | Status |
|---|---|---|
| `FORMSPREE_ENDPOINT` | Worker **secret** (`npx wrangler secret put FORMSPREE_ENDPOINT`) | ✅ `https://formspree.io/f/xzedobav`, live-tested on Cloudflare 2026-10-17 |
| `NEXT_PUBLIC_SITE_URL` | `.env.production` (committed; inlined at build) | ✅ workers.dev URL. **Change it here when a custom domain is added** |
| `INSTAGRAM_ACCESS_TOKEN`, `YOUTUBE_API_KEY`, `RESEND_API_KEY` | would be Worker secrets | not set (optional) |

Bindings (`wrangler.jsonc`):
- `NEXT_INC_CACHE_KV`: KV namespace `pooja-dugar-studio-cache` (`410a3ae7…`), the ISR/fetch cache.
- `WORKER_SELF_REFERENCE`: the Worker itself, used by the memory queue for background revalidation.
- `ASSETS`: static files.

Cache config: `open-next.config.ts` uses the KV incremental cache and the memory queue. The home page is ISR (1 h):
it is served from KV (`x-nextjs-cache: HIT`) and refreshes YouTube data in the background.

## Deploy
```bash
git pull
npm run cf:deploy          # opennextjs-cloudflare build && deploy → pooja-dugar-studio.vinayakch17.workers.dev
npm run cf:preview         # build + run locally in the Workers runtime (wrangler dev)
```
- `npm run build` runs `scripts/reel-videos.mjs` first (prebuild). It lists `public/reels/*.mp4` into
  `content/reel-videos.json`, because Workers have no filesystem at runtime.
- Wrangler is logged in as vinayakch17@gmail.com (single account). Check with `npx wrangler whoami`.
- GitHub isn't connected to Cloudflare; deploys are manual. Optionally connect the repo with Workers Builds.

## Testing tips
- `npm run dev`, or `npm run build && npm start`.
- The Claude-in-Chrome browser can't reach this Mac's localhost. Use local headless Chrome:
  - Use `--force-prefers-reduced-motion` for screenshots, otherwise animations get frozen mid-way.
  - For hover tests, drive it over CDP (`--remote-debugging-port`).

## Open items / next steps
1. **Reel mp4s** for hover-play (export from IG or originals; compress; ffmpeg isn't installed on this Mac).
2. **Real carousels** (post links) and **graphics** (image files).
3. **Real testimonials**, or remove the Reviews section. Its fake 5-star quotes shouldn't stay live.
4. Confirm the "best seller" / "new" badges in `lib/products.ts` are true.
5. **Delete the old Vercel project** `pooja-dugar-studio` (team thepoojaedit) once the Cloudflare site is confirmed.
   Never touch the `thepoojaedit` project.
6. Optional: custom domain (add in Cloudflare → Worker → Domains & Routes, then update `.env.production` and redeploy);
   Workers Builds for auto-deploy; Instagram token; YouTube API key.

## History
| Commit | Change |
|---|---|
| `e1fafb2` | Initial dark cinematic portfolio + enquiry form |
| `5eb7440` | Restyled as a Kylie-style storefront with bag + WhatsApp checkout |
| `9f7a4b6` | 12 real IG Reels with self-hosted covers |
| `bfaae08` | Hover-to-play; Instagram areas use Instagram imagery only |
| (this) | Moved from Vercel to Cloudflare Workers (OpenNext, KV cache) |
