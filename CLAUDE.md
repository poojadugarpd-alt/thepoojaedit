# CLAUDE.md — Pooja Dugar Edit Studio

Read `docs/HANDOFF.md` first. It is the source of truth for current state, open items, and deploy steps.
Update it whenever state changes.

## Ground rules
- **Two Macs / two sessions:** run `git pull` before starting.
- **Not PoojaEdit.** This deploys to the Vercel team `thepoojaedit` as its own project
  `pooja-dugar-studio`. Never touch the `thepoojaedit` project (the live fashion store).
- **Deploy:** `npx vercel deploy --prod --yes` from this folder. GitHub isn't connected to Vercel.
  Preview URLs are behind Vercel login, so verify on prod.
- **Design is owner-directed:** a Kylie Cosmetics-style storefront (white, rose condensed caps, blush).
  Keep changes consistent with the tokens in `app/globals.css`.
- **WhatsApp is the primary CTA everywhere.** Prices live only in `lib/site.ts`.
- **Instagram:** no scraping. Use official embeds, the Graph API, or manual entries in
  `content/instagram.json`. Self-host covers/videos in `public/reels/<shortcode>.{jpg,mp4}`; IG CDN URLs expire.
- **Don't invent social proof.** Testimonials, badges, and stats must be real or clearly labelled.

## Commands
```bash
npm run dev          # local dev
npm run typecheck    # tsc --noEmit
npm run build        # production build (run before every deploy)
```

## Map
- `app/page.tsx`: page sections. `app/api/enquiry/route.ts`: form backend.
- `components/Bag.tsx`: cart + drawer. `Shop.tsx`: products + reels-love row.
  `Showcase.tsx`: the 5 tabs. `Media.tsx`: cards, modal, hover-to-play. `ChatPanel.tsx`: form.
- `lib/instagram.ts`, `lib/youtube.ts`: data sources with fallbacks. `lib/categorize.ts`: caption → category.
- `lib/products.ts`: services as products. `lib/site.ts`: contact + pricing.

## Gotchas
- Claude-in-Chrome can't reach this Mac's localhost. Use headless Chrome; for hover, drive it via CDP.
- `next build` exits 0 even if a fetch to YouTube fails. The code falls back to RSS, then to empty states.
