# Pooja Dugar Studio

A single-page storefront-style portfolio and enquiry site for Pooja Dugar's video editing service, built with Next.js 15 (App Router). It has no CSS framework, no animation library, and no image CDN dependency.

> Current state, open items and deploy steps: see [docs/HANDOFF.md](docs/HANDOFF.md).

```bash
npm install
cp .env.example .env.local   # fill what you have; everything is optional
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

## Where content comes from

| Section | Default (no keys) | With keys |
|---|---|---|
| YouTube long-form + Shorts | Public RSS feed for the channel's auto-playlists `UULF…` (long-form) / `UUSH…` (Shorts). Live and needs no key, but only returns the latest 15 of each and no durations. | `YOUTUBE_API_KEY` → Data API v3: up to 50 of each, with durations and subscriber count. |
| Instagram Reels + Carousels | `content/instagram.json` (manual entries; ships with sample tiles) | `INSTAGRAM_ACCESS_TOKEN` → Instagram API with Instagram Login (Graph). Reels get muted autoplay previews. |
| Graphics | `content/graphics.json` + images in `public/graphics/` | n/a |
| Testimonials | `content/testimonials.json` (placeholders, labelled as such) | n/a |
| Prices, contact, WhatsApp | `lib/site.ts` | `NEXT_PUBLIC_WHATSAPP_NUMBER` |

Pages are statically generated and refreshed at most hourly (ISR, `revalidate = 3600`).
If an API fails, the site falls back to RSS or manual content rather than breaking.

### Adding work manually
- **Reel/carousel**: add an entry to `content/instagram.json` with the post's real `permalink`
  (e.g. `https://www.instagram.com/reel/ABC123/`) and remove `"sample": true`. Clicking it opens
  Instagram's official embed in a modal. Optional: `category` (`brand|affiliate|ugc`), `brand`,
  `thumbnailUrl`, `slideCount`, `carouselLabel`.
- **Graphic**: put the file in `public/graphics/`, then add `{ "image": "/graphics/x.webp", "category": "Poster", "alt": "…", "ratio": "4/5" }`.

### Instagram auto-categorisation
`lib/categorize.ts` reads the caption. Disclosures (`#ad`, `paid partnership`, `#collab`, `gifted`)
→ **Brand Reel**. Codes, `link in bio`, 🔗 and affiliate short links → **Affiliate**. `#ugc`,
review, unboxing, try-on, haul → **UGC**. Carousel albums → **Carousels**. Meta's API does not expose
the "Paid partnership" label itself, so this is heuristic. Fix any miscategorised post in
`content/instagram-overrides.json`, keyed by shortcode:
`{ "ABC123": { "category": "ugc", "brand": "@brand" } }`, or `"hidden": true` to drop it.

### Instagram token setup
The old Basic Display API was shut down in Dec 2024. Use **Instagram API with Instagram Login**:
1. Switch @poojadugar_ to a Creator/Business account.
2. Create a Meta app (developers.facebook.com) → add the Instagram product → generate a token for
   the account with `instagram_business_basic`.
3. Exchange it for a long-lived (60-day) token and set `INSTAGRAM_ACCESS_TOKEN`.
4. Refresh before it expires:
   `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN`
   (a monthly cron job works).

## Enquiry form
`POST /api/enquiry` validates input on both the client and the server (shared `lib/enquiry.ts`),
uses a honeypot field to catch bots, and then delivers to every configured channel:
- `RESEND_API_KEY` emails each enquiry to `ENQUIRY_TO_EMAIL` (poojadugar.pd@gmail.com), with reply-to set to the client. Verify a sending domain in Resend and set `RESEND_FROM`.
- `FORMSPREE_ENDPOINT` uses Formspree. It's the zero-setup option and Formspree emails the account owner.
- `GOOGLE_SHEETS_WEBHOOK_URL`: an Apps Script web app that appends the JSON body as a row.

If none is configured, the form says so and offers a pre-filled WhatsApp message, so an enquiry is never silently lost.

## Deploy
Vercel works with zero config: import the repo and add the env vars. Any Node host can also run it with `npm run build && npm start`.
