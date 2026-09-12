# Admin PWA — install & platform notes (Stage 3)

Technical companion to `/admin/install` (the owner-facing steps) and
`docs/admin-pwa-plan.md`. Written against WebKit/Apple's current public
documentation, checked 2026-09-12:

- [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) — WebKit blog
- [WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/) — WebKit blog
- [Web Application Manifest `id` member](https://developer.mozilla.org/en-US/docs/Web/Manifest/id) — MDN (the standard WebKit implements)
- [Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — WebKit blog (ITP / storage eviction)
- [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/) — WebKit

## Why two manifests, two icons

Next's `app/manifest.ts` file convention is **root-only** — confirmed
empirically this stage: a `src/app/admin/manifest.ts` compiles but produces
no route at all, `/admin/manifest.webmanifest` 404s. `icon`/`apple-icon` file
conventions, by contrast, are documented as segment-scoped — but also did
**not** reliably override the root icon for `/admin` in this build when
tested the same way (a `src/app/admin/apple-icon.png` got its own static
route, `/admin/apple-icon.png`, yet the `/admin` page's rendered `<head>`
still linked the root `/apple-icon.png`). Rather than depend on that, this
stage:

- serves the admin manifest from a plain Route Handler at the literal path
  `src/app/admin/manifest.webmanifest/route.ts`, and
- sets `icons.apple` **explicitly** in `metadata` (`src/app/admin/layout.tsx`)
  instead of relying on the `apple-icon.png` file convention.

That second point matters more than it sounds: per the WebKit blog post
above, *"If you do both, `apple-touch-icon` will take precedence over the
Manifest-declared icons."* — so the HTML `<link rel="apple-touch-icon">` tag
is what actually puts an icon on an iOS home screen, not the manifest's
`icons` array. The manifest's icons still matter for other install surfaces
(desktop Chrome/Edge "Install app", Android), so both are set.

Icons: `public/brand/admin-icon-{192,512}.png` and
`admin-apple-touch-icon.png` are `design/logo/mark-circle.png` (the
signature-mark-in-a-circle, already part of the brand kit — D-96) flattened
onto a solid `#EDE0CC` (beige) square with `sharp` — the same mark as the
shop icon, palette inverted (shop = maroon square / beige mark; admin =
beige square / maroon mark), so the two are unmistakable from each other on
a home screen at a glance, not just by their text labels.

## Manifest `id`

Both manifests now set `id` explicitly (`"/"` for the storefront, `"/admin"`
for admin) rather than leaving it to default to `start_url`. Per the Safari
16.4 notes: *"To support notifications and badging for multiple installs of
the same web app, WebKit adds support for the `id` member... iOS and iPadOS
use the Manifest ID for the purpose of syncing Focus settings across
multiple devices."* Two different `id`s on the same origin is exactly what
tells iOS these are two separate installable apps, not two shortcuts to the
same one. Needs iOS/iPadOS **16.4+**; on older Safari the `id` member is
simply ignored and each manifest still installs correctly as an independent
icon (scope/start_url alone already separate them).

## Why a domain cutover forces a reinstall

`id`, `scope`, and `start_url` are all same-origin, relative paths — they
resolve against whatever origin actually served the manifest. An app
installed today from `https://thepoojaedit.vercel.app` and one installed
later from `https://thepoojaedit.in` are, to iOS, two unrelated web apps
that happen to look alike, not one app that moved. There is no supported way
to "repoint" an installed icon at a new origin — this is inherent to how the
Manifest standard scopes identity, not a bug in this build. `/admin/install`
tells the owner this in plain terms and names both URLs.

## Why the service worker only caches static assets + one offline page

`src/app/admin/sw.js/route.ts` is hand-written (no Workbox/next-pwa, per the
brief). It caches exactly two kinds of thing:

1. Same-origin GET requests under `/_next/static/` — Next's build output,
   content-hashed filenames. Safe to cache indefinitely because a new
   deploy produces new filenames; there is no "stale JS" failure mode.
2. A short, explicit list of genuinely static files (`/admin/offline.html`,
   the two admin icons).

Every navigation (a real page load) is network-only; on failure it falls
back to the cached offline page, never to a cached copy of a real page. The
worker doesn't call `respondWith()` at all for anything else — every
`/admin/*` RSC fetch, every `/api/*` call, every server-action POST goes
straight to the network exactly as if the worker weren't installed. An admin
console that could show a cached order, a cached stock count, or a cached
price would be a genuine correctness bug, not a convenience — so nothing
"dynamic" is cacheable at all, by construction, rather than by a runtime
check that could be gotten wrong.

Because nothing dynamic is cached, updates need no reload prompt: `install`
calls `skipWaiting()` and `activate` calls `clients.claim()` unconditionally
— there is no "old app shell talking to a new API" risk to guard against
the way there would be with an app-shell-cached SPA.

## Storage/lifecycle caveats worth knowing

- **Regular Safari tab vs. installed app**: WebKit's Intelligent Tracking
  Prevention deletes a site's script-writable storage (IndexedDB,
  localStorage, Service Worker registrations included) after **7 days**
  without the user visiting that site in a normal tab. A **Home Screen web
  app is exempt** from this — its origin is skipped entirely by that
  removal pass, and it has its own usage counter based on actually opening
  the installed app. This is a real, practical reason to install rather
  than "just bookmark the URL": a bookmark opened in Safari is still subject
  to the 7-day rule; the installed app is not.
- Even for an installed app, WebKit removes an unused service worker
  registration (and its caches) after a few weeks of the app not being
  opened at all. Harmless here by design — re-registration on next open is
  automatic (`RegisterServiceWorker`) and nothing depended on the cache
  surviving.

## Web Push — what Stage 4 will build against

Not implemented yet (Stage 4). Recorded here since it constrains that
design: per the WebKit blog, *"A web app that has been added to the Home
Screen can request permission to receive push notifications as long as that
request is in response to direct user interaction"* — i.e. the permission
prompt cannot fire on page load; it needs an explicit button tap, and only
works once the icon is actually installed (a browser tab cannot receive Web
Push on iOS at all). Needs iOS/iPadOS 16.4+; below that, push is simply
unavailable and the notification-preferences UI will need to say so rather
than fail silently.
