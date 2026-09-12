import { NextResponse } from "next/server";

// Content never varies by request.
export const dynamic = "force-static";

/**
 * Serves the admin service worker's JS at /admin/sw.js — a literal path
 * (folder named "sw.js" containing this route.ts), not a build asset, so it
 * can be hand-edited without a bundler step. Registered from
 * src/features/admin/register-sw.tsx with `{ scope: "/admin/" }`; because
 * the script itself is served from under /admin/, that's also its default
 * max scope, so no `Service-Worker-Allowed` header is needed to keep it off
 * the storefront.
 *
 * `Cache-Control: no-cache` (not no-store) — browsers already re-check a
 * service worker script for byte-for-byte changes roughly every 24h even
 * with strong caching, but `no-cache` makes that revalidation explicit
 * rather than relying on that browser-specific behaviour.
 */
export function GET() {
  return new NextResponse(SW_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/admin/",
    },
  });
}

// Bump this string on any change to what/how this worker caches — it names
// the Cache Storage bucket, so a bump makes `activate` throw away every
// entry from the previous version instead of trying to reconcile them.
const SW_SOURCE = String.raw`
const CACHE_VERSION = "admin-sw-v2";
const OFFLINE_URL = "/admin/offline.html";

// Everything precached is genuinely static and non-personal: the offline
// fallback page and the two admin home-screen icons. Nothing here ever
// contains an order, a price, a customer, or a session.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/brand/admin-icon-192.png",
  "/brand/admin-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Take over from any previous worker immediately — safe here because
      // nothing dynamic is ever cached (see the fetch handler below), so
      // there is no "stale app shell" risk that would call for waiting on a
      // user-initiated reload instead.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// A request qualifies for caching ONLY if it is a same-origin GET to a
// Next.js build asset (content-hashed filename — a new deploy gets new
// hashes, so this can never serve stale JS/CSS) or to one of the explicit
// PRECACHE_URLS above. Everything else — every /admin/* page, every RSC
// navigation fetch, every /api/* call, every server action POST — falls
// through untouched: no respondWith(), no interception, straight to the
// network exactly as if this worker did not exist. That is deliberate: an
// admin console is never allowed to show stale orders, stock or prices, or
// to let a cached response stand in for an auth check.
function isCacheableAsset(url) {
  return url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || PRECACHE_URLS.includes(url.pathname));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    // Network-only for every navigation — never serve a cached document.
    // The offline page is the ONLY fallback, and only on an actual network
    // failure, never as a stand-in for a slow or authenticated response.
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (!isCacheableAsset(url)) return; // let the browser handle it natively

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

// Admin PWA Stage 4 — Web Push. The payload is exactly what sendAdminPush
// (src/server/notifications/push.ts) sent: { title, body, url }. Nothing
// here reaches back into the network or a cache — it only has whatever the
// push service delivered, kept deliberately minimal (a short title/body, no
// order contents, no customer data) since it also has to fit on a lock
// screen.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON — show nothing rather than guess at a shape.
  }
  const title = data.title || "Pooja Admin";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/brand/admin-icon-192.png",
      badge: "/brand/admin-icon-192.png",
      data: { url: data.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

// NOT handled: 'pushsubscriptionchange' (fired if the browser rotates or
// expires a subscription on its own). A Service Worker can't easily call a
// Next.js Server Action, and this event is rare in practice over this
// project's timeframe — known gap, not an oversight. Today's actual pruning
// path is sendAdminPush deleting a subscription once the push service
// reports it gone (404/410) on an actual send attempt.
`;
