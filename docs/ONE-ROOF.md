# One roof: all Pooja Dugar work in this repo

_Written 2026-10-20 (D-171). For any Claude chat or person picking up Pooja work. Read this first, then the handoff for the part you're touching._

## What changed on 2026-10-20

The **editing-service site** (Pooja Dugar Studio, https://studio.thepoojaedit.in) moved into **this repo** under `studio/`, with its full git history (git subtree from `vinayakch17/pooja-dugar-studio` @ `bbf1adf`).

- The old repo `vinayakch17/pooja-dugar-studio` is **frozen**. Don't commit there.
- The old local folder `~/Documents/pooja-dugar-studio` on the `vinayak` Mac is now stale. Work in `~/Documents/PoojaEdit/studio`.
- **Hosting did not change.** The store is still on Vercel and the studio is still on Cloudflare Workers. Nothing was redeployed.
- One `git pull` in `~/Documents/PoojaEdit` now brings both projects up to date on either Mac.

## Brand map (owner's view)

```
Pooja Dugar (master brand)
├─ 1. Instagram @poojadugar_       PR outreach supports this
├─ 2. YouTube                      nothing built for it yet
├─ 3. thepoojaedit.in              THIS REPO (root), Vercel, real customers
│    ├─ Label          new apparel                      live
│    ├─ Closet         one-of-one thrift, /closet       live
│    └─ Shop Looks     → LehLah (D-167); own Looks removed (D-168)
├─ 4. Styling Service  /styling (D-162, published D-165)  live
└─ 5. Editing service  studio.thepoojaedit.in            THIS REPO, studio/
```

## Where everything is

| | Store (repo root) | Studio (`studio/`) | PR outreach |
|---|---|---|---|
| What | Fashion e-commerce, **real customers and orders** | Editing-service storefront (Reels/YouTube/carousels/graphics; checkout over WhatsApp) | Brand PR forms and emails for @poojadugar_ |
| Live | https://thepoojaedit.in | https://studio.thepoojaedit.in | n/a |
| Hosting | **Vercel**, team `thepoojaedit` | **Cloudflare Workers**, account vinayakch17@gmail.com, Worker `pooja-dugar-studio` (served via the forwarder Worker `studio-thepoojaedit` in Pooja's CF account) | Google Sheet "Pooja PR Forms" (poojadugar.pd@gmail.com) |
| Deploy | Push to `main` → Vercel auto-deploys (runs `prisma migrate deploy` first) | `cd studio && npm ci && npm run cf:deploy` (manual; pushing does **not** deploy the studio) | Never submit or send; prefill only (`~/.claude/skills/pr/SKILL.md`) |
| Source of truth | `docs/HANDOVER.md` §8 + `docs/decisions.md` (D-numbers) | `studio/docs/HANDOFF.md` + `studio/CLAUDE.md` | The sheet |
| Packages | root `package.json` / `node_modules` | its own `studio/package.json` / `studio/node_modules` (separate install) | n/a |

## How the two apps are kept apart

- The store's `tsconfig.json`, `eslint.config.mjs`, `.prettierignore` and Tailwind (`@source not "../../studio"` in `src/app/globals.css`) all skip `studio/`, so store CI (`lint`, `typecheck`, `test`, `build`) never sees studio code.
- `studio/next.config.mjs` sets `outputFileTracingRoot` to `studio/` so its Cloudflare build ignores the store's lockfile.
- `vercel.json` has an `ignoreCommand`. When a push changes **only** files under `studio/`, Vercel skips the store build. It's safe by default: if Vercel has no previous deployed SHA, or anything outside `studio/` changed, the store builds as normal.
- Verified on 2026-10-20: the store passes lint, typecheck, Prettier, 158 unit tests and `next build`; the studio passes typecheck and `opennextjs-cloudflare build`, both from the new layout.

## Rules that still apply

- **The store is production.** Follow the D-number log for any store change, and never touch store DNS (apex/`www`/`img`/mail) from studio work. `studio.` is the studio's only record. The TXT `google-site-verification=…` on `@` is Search Console's ownership proof for both sites — never delete it.
- **Never deploy the studio to Vercel.** It's a separate Next.js app in a subfolder; the Vercel project builds the repo root only.
- Studio ↔ store cross-links are **live** since 2026-10-20 (owner approved: footer + About on both sites, D-172/D-174). Both sites' schema name Pooja as one Person (`https://thepoojaedit.in#pooja-dugar`).
- Owner decisions are asked as pop-up multiple-choice questions.
- In Chrome, use the Pooja profile (GitHub `poojadugarpd-alt`) for this repo.

## SEO / search (2026-10-20)

Plan `~/Documents/Pooja-SEO-AEO-Plan.md` (poojadugar Mac); owner status page https://claude.ai/artifact/XBVpviqzn2HYLXVY7FYUwB. Store: D-172/D-173; studio: D-174. Search Console domain property and Bing cover both sites. Google Business Profile for styling exists but is **unverified** (owner to verify). Instagram/YouTube SEO not started. Details: `docs/HANDOVER.md` §5 "SEO / AEO and search accounts".

## Open items carried over (studio)

Reel hover mp4s (needs ffmpeg), real testimonials (Reviews section is hidden until they exist), confirming the best-seller/new badges are true. See `studio/docs/HANDOFF.md` for the rest.
