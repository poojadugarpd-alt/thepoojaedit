# Review system plan (2 Nov 2026), draft for owner approval. Nothing built.

Goal: clients of the editing studio and of personal styling can leave a review plus contact details on the site. Pooja approves each one before it appears. Contact details stay private.

## What exists today
- Store (Next.js on Vercel, Prisma and Postgres): Admin has Styling > Testimonials (hand-entered, shown as "Kind words" on /styling and the guides). StylingEnquiry model and server action show the pattern for a public form with a database row, UTM capture and Admin notification preferences. Resend email transport exists.
- Studio (Next.js on Cloudflare Workers): no database. /api/enquiry emails Pooja via Resend, with a honeypot. No Admin.

## Design
One database, one Admin. Reviews live in the store database; the studio sends and reads through the store's API. This avoids building a second admin and database on Cloudflare.

Data (new Prisma model `Review`, additive migration):
- site (STYLING | STUDIO), service (free text copied at submit), rating 1 to 5 (optional), text, displayName, instagram (optional), city (optional)
- private: email, phone (optional), consentPublish (name and text), consentContact, ip hash, userAgent hash
- status (PENDING | APPROVED | HIDDEN), source (INVITE | OPEN), inviteId (optional), note (owner), createdAt, approvedAt, utm fields like StylingEnquiry
- Invite model (optional phase): token, clientName, site, service, usedAt. Lets Pooja send a one-time link in WhatsApp so the review is marked "verified client".

API (store):
- POST /api/reviews: validates, honeypot, Turnstile (the CAPTCHA-free Cloudflare check), per-IP rate limit, origin allowlist (thepoojaedit.in and studio.thepoojaedit.in), no links in text, length limits. Saves PENDING. Emails Pooja.
- GET /api/reviews?site=studio|styling: approved only, public fields only, cached, tag-revalidated on approve.

Admin (store): Admin > Reviews with PENDING / APPROVED / HIDDEN tabs; approve, edit spelling, hide, delete, see private contact, copy WhatsApp link. Approving also pings IndexNow for pages that show reviews. New notification toggle "New review" next to the styling enquiry one.

Public display:
- Studio: new "what clients say" block on /fashion-creators, /pricing, the home page and /ugc; a /review page with the form, linked from those pages and from invite links.
- Store: approved STYLING reviews feed the existing "Kind words" block on /styling and the guides, merged with hand-entered ones.
- No Review or AggregateRating structured data: Google ignores a site's reviews of itself in star results, so it only adds risk. Plain text on the page.

Privacy (India DPDP Act): form shows a short notice (what is collected, who sees it, why, how to ask for deletion), separate tick boxes for publishing and for being contacted, contact details never public, and a delete action in Admin. Add a line to the privacy policy.

## Phases
0. Owner decisions (below).
1. Model, migration, API, tests (store). Dev database is currently unreachable ("tenant not found"), so I need a working dev database or use the test database first.
2. Admin moderation and notification.
3. Form components for both sites, /review page, Turnstile.
4. Display blocks on both sites.
5. Optional: invite links and verified badge.
6. Full checks, review page, owner approval, then deploy in order: store (migration auto-applies) then studio. Owner deploys studio.

## Decisions for the owner
1. Open to anyone with approval, invite-only, or both with a "verified client" badge.
2. Fields: rating or text only; optional photo or Instagram handle; city.
3. What shows publicly: first name only, name plus Instagram, or the client chooses.
4. Whether styling reviews appear in "Kind words" automatically after approval.

## Owner decisions (2 Nov 2026)
1. Both: anyone can submit with approval, and invited clients get a "verified client" mark (invite links are in scope).
2. Fields: star rating 1 to 5 and Instagram handle (no photo, no city field required).
3. Public name: the client chooses (first name only, or name plus Instagram).
4. Approved styling reviews appear in "Kind words" automatically.
Status: plan approved, build not started. Open issue: dev database unreachable; use the local test database (npm run test:e2e:local) for tests.
