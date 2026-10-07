# Assessment of the website agent brief (/picks and /styling)

Written 7 October 2026, against `pooja-website-agent-brief.md` and the site as it stands (thepoojaedit.in, Next.js + Prisma + Supabase, own admin, Resend email). Owner decision the same day: **keep the analysis, build nothing yet.**

## Verdict

Don't build the brief as written. If and when the site work starts, use the staged plan below. It begins with the Personal Styling page; "Shop this Reel" Looks come after the Instagram test; full Picks reviews come only once real reviews exist.

## What the brief gets right

- Strict honesty rules: no invented reviews, testimonials, prices, client results or credentials.
- External products never enter the site's cart.
- Extend the existing site; don't rebuild or migrate it.
- An enquiry form shows success only when the enquiry is really stored or delivered.
- Private enquiry data is kept apart from public content.

## Why it's the wrong scope right now

1. **Agency-sized for a one-person shop.** It asks for 4 launch routes plus 6 later ones, about 17 new components, a filter taxonomy, a content model, 9 analytics events and an 8-week publishing calendar.
2. **The content doesn't exist yet.** Every page needs Pooja's review notes, approved affiliate links, service fees, a portrait and client stories. The brief forbids thin pages, so building now produces a shell that can't launch.
3. **It cuts against the Instagram plan.** The audit's main finding (3 Oct) was that the audience isn't sent to Pooja's own businesses. The test running 6 Oct to 3 Nov measures bio-link taps and Label/Closet orders (E3/E4). Putting Picks in the main navigation and on the homepage would:
   - send traffic to other retailers for a small commission instead of to Label and Closet at full margin;
   - change the site mid-test, which spoils the measurement.
4. **It duplicates LehLah.** "Shop My Looks" and the comment-keyword flow already handle affiliate links. A second catalogue on the site means double upkeep and stale prices or links. LehLah's terms may also restrict where its links can appear.
5. **The tracking doesn't exist.** The site has no analytics. The UTM order-source tracking (D-136, branch `utm-attribution`) isn't released.

## Staged plan (when the time comes)

1. **UTM tracking (D-136).** It's already built. It needs updating onto D-137–D-140, then releasing.
2. **`/styling`: Personal Styling & Shopping.** This is the best value in the brief: one client likely beats months of affiliate commission, and Pooja has worked with overseas clients before.
   - **The page:** the offers (quote-based is fine), the process, an "abroad" note, and a link to About.
   - **Enquiries:** a short form, saved privately in the database, emailed to Pooja through Resend, and listed in admin.
   - **Links:** footer, About and one small homepage section, not the main navigation yet.
   - **Needs from Pooja:**
     - what each offer includes;
     - fees, or "quote on request";
     - which regions she'll take on;
     - a portrait;
     - where enquiry emails should go.
3. **After the 3 Nov review, if link-tap data supports it: Looks (`/looks/[slug]`)** instead of a full Picks catalogue.
   - Each Look is a Shop-this-Reel page Pooja creates in admin in a couple of minutes.
   - **Her own Label and Closet pieces come first, with Add to cart.**
   - External items follow, labelled "Shop at <retailer> ↗" and linked with `rel="sponsored"` via her LehLah URLs.
   - Comment keywords point to these pages.
4. **Picks product reviews, only once Pooja writes real reviews.** They'd be built on the Looks pages, adding verdicts, fit notes and the answer-first format. This is a long-term search play.

**Leave out until real demand shows up:**
- the four-item navigation and four-destination homepage;
- filters and unified search;
- the newsletter split;
- the analytics event plan;
- the future service and country pages.

## Useful parts of the brief to reuse later

- §5 for the `/styling` page sequence and enquiry-form rules.
- §4G, the Shop-this-Reel template, which should label mixed destinations explicitly.
- §8, the SEO rules: `rel="sponsored"`, no fake ratings, and no FAQ rich-result claims (Google retired them in May 2026).
- §9, the question backlog, as raw material for reviews and Reels.
- §14, the owner-inputs list.
