---
name: llms-txt
description: Generate or update public/llms.txt — a plain-text brand/catalog summary for generative AI engines (ChatGPT, Perplexity, Claude) to crawl and cite, the GEO equivalent of robots.txt. Use when brand facts, catalog structure, or policies change materially, or when asked to set up/refresh llms.txt.
---

# llms.txt — Generative Engine Optimization

`llms.txt` is an emerging plain-text convention, served at the site root
(`public/llms.txt` → `https://thepoojaedit.in/llms.txt` once the domain
cutover happens, or the Vercel URL until then), summarizing what a site is
for LLM-based crawlers/agents to read directly instead of parsing HTML. It's
the GEO-specific lever — traditional SEO robots don't need it, but tools like
ChatGPT/Perplexity that cite sources benefit from a clean, factual summary
they don't have to extract from marketing copy.

## Source of truth

Pull real facts from `docs/01-master-specification.md` and
`docs/decisions.md` — never invent brand details. Keep this file in sync
when those change (e.g. new catalog, changed shipping/returns policy, GST
info once D-122-blocked owner config lands).

## Structure (Markdown, per the emerging llms.txt convention)

```markdown
# PoojaEdit — The Pooja Edit + Thrift Store

> [One or two sentence factual summary: solo Instagram-led Indian fashion
> brand, two catalogs — new apparel ("Label") and one-of-one thrift resale
> ("Closet") — real e-commerce, real orders.]

## Catalogs
- Label: [what it is, in one line]
- Closet: [what it is, in one line — emphasize one-of-one/thrift nature]

## Policies
- Shipping: [factual summary, or "see /policies/shipping"]
- Returns: [factual summary, or "see /policies/returns"]
- Payment methods: [Razorpay prepaid, COD — only what's actually true]

## Links
- Homepage: https://thepoojaedit.in
- Label catalog: /label
- Closet catalog: /closet
- Contact: /contact
```

## Rules

- Every claim must be independently verifiable elsewhere on the live site —
  this file is a summary for a crawler, not marketing copy, and an AI engine
  citing a false claim from it is a real trust problem for a live commerce
  site.
- Do not include anything not yet true (e.g. don't claim GST/legal-name
  details while invoices are still DRAFT-watermarked per HANDOVER §6 — leave
  that section out or mark it pending until the owner confirms it).
- Regenerate/update, don't hand-append — keep it short and current, not an
  ever-growing changelog (that's what `docs/decisions.md` is for).
- After writing/updating `public/llms.txt`, confirm it's reachable at
  `/llms.txt` (Next.js serves files under `public/` at the root
  automatically — no route handler needed).
