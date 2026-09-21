---
name: structured-data-audit
description: Audit PoojaEdit storefront pages for SEO/AEO metadata and JSON-LD structured data gaps (title/description length, canonical, OG/Twitter tags, Product/BreadcrumbList/Organization/FAQPage schema). Use before/after changing or adding a storefront route, or when asked to check SEO on a page.
---

# Structured data / metadata audit

PoojaEdit already has a real foundation: `src/app/sitemap.ts`, `src/app/robots.ts`,
and per-route `generateMetadata`/`export const metadata` across most pages.
`src/features/catalog/product-detail.tsx` has the reference JSON-LD pattern —
a `<script type="application/ld+json">` with a `Product`/`Offer`/`Brand`
schema.org object, `priceCurrency: "INR"`, and `availability` mapped from
real stock. **Use that exact pattern as the template** — don't invent a
different shape.

## What to check per page type

| Page type | Routes | Should have |
| --- | --- | --- |
| Product detail | `label/[slug]`, `closet/[slug]` (or wherever thrift PDPs live) | `Product` JSON-LD (already exists — verify it's still correct after any pricing/variant change), unique title/description per product, canonical URL |
| Collection / listing | `label`, `closet`, `label/collections/[slug]` | `BreadcrumbList` JSON-LD, `ItemList` (optional), title/description reflecting the specific collection, canonical URL (watch for filter/query-param duplicate-content risk) |
| Homepage | `app/page.tsx` (or root layout) | `Organization`/`WebSite` JSON-LD (brand name, logo, sameAs → Instagram), title/description |
| Policies / About / Contact | `policies/[slug]`, `about`, `contact` | title/description at minimum; `FAQPage` JSON-LD if the content is genuinely Q&A-shaped (return policy, shipping FAQ) — this is the schema AI Overviews/ChatGPT/Perplexity lift directly into an answer |

## Per-page checklist

1. **Title**: unique, ~50-60 chars, product/collection name first.
2. **Meta description**: unique, ~140-160 chars, no truncated sentences.
3. **Canonical URL**: present, absolute, points at the real primary URL
   (matters here specifically — Label and Closet are two catalogs, watch for
   any accidental duplicate slugs/URLs across them per D-125's cross-catalog
   guards).
4. **Open Graph / Twitter card**: `og:title`, `og:description`, `og:image`
   (real product/brand image, not a placeholder), `og:type`.
5. **JSON-LD**: correct `@type` for the page (see table above), valid JSON
   (no `undefined` leaking into the serialized output — check how
   `product-detail.tsx` guards optional fields), matches what's actually
   rendered on the page (Google penalizes structured data that doesn't match
   visible content).
6. **Sitemap**: new routes are actually reachable from `sitemap.ts`'s query,
   not just linked in nav.
7. **Answer-shaped content (AEO/GEO)**: for policy/FAQ-like content, is the
   actual prose written as a direct, quotable answer to a likely question
   (e.g. "What is your return policy?" immediately followed by a clear
   answer), not buried in marketing copy? This is what makes content citable
   by AI Overviews and generative engines, not just crawlable by Google.

## Output

Report findings as a short list per page: what's present, what's missing,
and the concrete fix (code snippet if it's a schema addition, following the
`product-detail.tsx` pattern). Don't add schema types that don't map to real
content on the page — invalid/mismatched structured data is worse than none.
