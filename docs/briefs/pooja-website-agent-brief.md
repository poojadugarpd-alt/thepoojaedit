# The Pooja Edit: website agent implementation brief

Prepared 6 October 2026. This document is a self-contained prompt and implementation specification. Give it to the AI agent that maintains the existing website. Proposed routes and features below are not live implementations.

## Copy-ready prompt for your website agent

Added 7 October 2026. Copy the prompt below into your agent's conversation and attach this file. The complete implementation specification follows the prompt.

---

Extend my existing website, https://thepoojaedit.in/, using the attached “pooja-website-agent-brief.md” as the implementation specification.

Read the entire brief before making changes. Work in the existing website project and inspect its repository instructions, framework, routing, design tokens, commerce integration, content management, forms and analytics. Reuse the existing architecture and visual identity.

Implement two connected destinations:

1. Pooja’s Picks at /picks: original fashion reviews, curated shopping edits, Shop this Reel destinations, useful filters and clearly labelled external retailer links.

2. Personal Styling & Shopping at /styling: a founder-led service page explaining the offers, process, deliverables, overseas-client considerations, genuine evidence and a working enquiry journey.

Integrate these into the existing navigation, homepage, footer and relevant Instagram content. Preserve Label and Closet’s existing product, stock, cart and checkout behaviour. External Picks must never appear to be products sold through our checkout.

Follow the brief’s page sequences, reusable components, mobile behaviour, editorial approach and restrained motion. Retain the existing white/warm-neutral/burgundy identity and typography. Make the new page introductions compact enough that visitors quickly reach useful products or service information.

Create maintainable content records and reusable review/edit templates. Use the existing CMS or the smallest compatible editing workflow. Keep private enquiry data separate from public editorial content.

Build the SEO/AEO foundations described in the brief: meaningful rendered content, unique metadata, stable URLs, appropriate canonicals and indexing, accessible answers, truthful structured data, commercial-link attributes and internal links. Keep future content topics as an editable backlog rather than publishing thin or fabricated pages.

Use only genuine approved product details, review evidence, affiliate links, photographs, service terms and client material. Never invent testimonials, ratings, client results, qualifications, prices, availability or shipping promises. Illustrative examples may appear in a clearly labelled private preview; they must not accidentally enter production or search indexes.

Make every interactive element functional. Verify filters, destination links, mobile navigation and enquiry validation. A form must only show success when the backend confirms receipt. If an integration is unavailable, identify the precise blocker instead of simulating success.

Ask one consolidated set of questions for essential missing business information, while continuing work that does not depend on those answers. Resolve routine implementation choices using the existing project and brief.

Deliver:
- A working preview of both destinations and reusable detail templates.
- Desktop and mobile screenshots.
- A summary of functional, accessibility, SEO and performance checks.
- Confirmation that existing commerce behaviour remains intact.
- Instructions for adding reviews, edits, services and approved client stories.
- A precise list of missing content or integration inputs.
- A clear distinction between completed features and future enhancements.

Complete the implementation and verification in the preview environment. Publish to production only if that action is already authorised in this project or I subsequently request it.

---

## 1. Your assignment

Extend the existing website at https://thepoojaedit.in/ with two connected business destinations:

1. **Pooja’s Picks**, at `/picks`: original fashion reviews, curated shopping recommendations and complete looks, with eligible affiliate links.
2. **Personal Styling & Shopping**, at `/styling`: a founder-led service for clients seeking personalised styling and shopping assistance, including clients living abroad.

Build within the existing project. Inspect repository instructions, framework, routing, styling tokens, commerce integration, content storage, authentication, forms and analytics before implementation. Reuse working infrastructure. Do not infer the stack from the public site's appearance, migrate the framework, create a second website, or replace the commerce system merely to add these features.

Deliver a working preview, editable content structures, meaningful validation and a concise handover. The owner is asking for an addition to an established site, not a wholesale redesign. Production publishing is a separate step unless already authorised in the implementation session.

### Confirmed context

- The public site was inspected in Chrome on 6 October 2026.
- Existing navigation includes Label, Closet, Search and Cart.
- Existing routes include `/label`, `/closet`, product detail routes, `/search`, `/cart`, `/about`, contact and policy pages.
- Label and Closet share the site's shopping bag and checkout experience.
- The site has product imagery, an Instagram section, a drop-list email signup and staff sign-in.
- Its visual identity uses white and warm neutral surfaces, dark typography, a burgundy wordmark/signature and spacious editorial composition.
- Pooja’s creator positioning is wearable fashion, honest try-ons, reviews and shopping recommendations.
- Her public Instagram bio identifies Delhi and a height of 5’7”.
- She has previously served overseas clients for a mix of styling and shopping. No client count, testimonial, revenue, service geography beyond that statement, or operational guarantee has been verified.
- Her Instagram profile links to an existing LehLah shopping destination. Provider eligibility, website placements and tracking capabilities must be confirmed before integration.

### Business boundaries

Label and Closet products use the existing checkout. External Picks link to the named retailer and never enter the site's cart. Styling enquiries lead to a scoped service conversation, not an unapproved instant payment or confirmed appointment.

Use genuine content and approved assets. Never invent reviews, testimonials, certifications, availability, client photographs, savings, discounts, ratings, purchase histories, shipping promises or service prices. Data fixtures are permitted in a clearly marked private preview only; exclude them from production, indexing, analytics and structured data.

## 2. Shared architecture and integration

Desktop navigation: **Label · Closet · Pooja’s Picks · Personal Styling**, with Search and Cart retained. At narrow widths use a proper mobile menu rather than shrinking labels until they are unreadable. Highlight the active destination. Use “Personal Styling & Shopping” as the full service title inside the page.

Launch routes:

| Route | Purpose | Publication requirement |
|---|---|---|
| `/picks` | Browse recommendations and recent edits | Approved product/review data |
| `/picks/products/[slug]` | One original product review | Evidence-backed review and real images |
| `/picks/edits/[slug]` | Curated edit or Shop this Reel destination | A useful, complete collection |
| `/styling` | Service overview, packages, process and enquiry | Confirmed scope and working enquiry destination |

Prepare reusable templates, but publish these later only when they have distinct substantive content:

- `/styling/virtual`
- `/styling/personal-shopping`
- `/styling/occasion`
- `/styling/stories/[slug]`
- `/guides/[slug]`
- Curated category landing pages under `/picks`, where editorial demand justifies them.

Do not publish empty location/service pages, duplicated synonyms or a directory of imaginary countries served.

### Homepage additions

- Keep Label and Closet products prominent and their checkout intact.
- Add a four-destination introduction: **My Label / My Closet / My Picks / Work with me**. On mobile these can be simple stacked links, not four dense cards.
- Add a small “From Pooja’s Picks” preview with three or four real reviews and a link to `/picks`.
- Add a compact service invitation featuring Pooja and “Need an edit made for you?” linking to `/styling`.
- Where approved product mapping exists, add “Shop this look” to the existing Instagram section. Retain a way to view the original post. Never infer product identity automatically from an image.
- Extend footer navigation and add an editorial/disclosure link.
- Scope the existing shared-checkout promise explicitly to Label and Closet. Do not imply that affiliate retailers or styling enquiries share that checkout.
- Proposed homepage umbrella headline: **“Wear it your way.”** Supporting direction: introduce the label, preloved wardrobe, personal recommendations and styling help in one short paragraph. Preserve the owner's current homepage copy until the expanded version is approved.

### Search

Preserve existing store search. If extending it, clearly label result types: Label product, Closet item, Pick, Guide, Service. Do not mix external products into store inventory, stock totals or checkout recommendations without their correct destination labels. Picks can have scoped search at launch if unified search would require a large rewrite.

## 3. Design language

**Direction: a personal fashion editor’s notebook within The Pooja Edit.** The product photography and Pooja's judgement are the visual focus. Styling is more personal and reassuring; Picks is more immediately browsable. Both should unmistakably belong to the current website.

### Visual system

- Reuse the real logo, burgundy brand accent, current type families and existing component conventions. Extract exact values from code; do not pretend screenshot estimates are brand tokens.
- Use white for product browsing, a restrained warm neutral for supporting notes and dark text for reading. Reserve burgundy for primary actions, links and selected states. Verdicts always have text; colour alone must never convey meaning.
- Use flat layouts, quiet separators and generous spacing. Avoid stacked containers, oversized pill treatments for every element, glass effects, gradients, decorative dashboards, generic fashion stock imagery and excessive drop shadows.
- Retain the established typographic character but make the new page introductions more compact than the current homepage hero. A visitor should see a useful item or service action without a long introductory scroll.
- Suggested implementation ranges, subordinate to current tokens: mobile H1 34–42px, desktop H1 48–64px, body 16–18px, metadata at least 13–14px. Keep readable text widths around 60–70 characters. Test actual text wrapping rather than enforcing these numbers blindly.
- Use 16–20px mobile gutters and a sensible desktop content maximum around 1200–1360px if compatible with the existing layout. Use a consistent spacing scale with roughly 48–80px between major sections, not enormous blank screens.
- Product imagery: consistent 3:4 aspect ratio, controlled cropping and a neutral background where the source supports it. Preserve garment shape. Portraits and service examples should use actual approved assets.
- Prefer concise sentence-case interface labels. Use all caps only where inherited navigation styling calls for it.

### Mobile experience

- Design first for a phone opened from Instagram. Check 360px, 390px, tablet and desktop widths, plus 200% zoom and narrow reflow.
- Two product columns only where images and text remain comfortable; fall back to one column when needed. Use a one-column editorial review layout.
- Use a Filter button opening an accessible sheet. Selected filters and a Clear all action remain visible after closing.
- Keep primary actions thumb-friendly with approximately 44px or larger touch areas. A sticky action must not overlap content, the keyboard, consent controls or device safe areas.
- Never require hover, autoplay, account creation or an email address to read reviews or find product links.
- Maintain keyboard focus, visible focus styles, semantic headings, labelled fields and sufficient contrast. Target WCAG 2.2 AA and verify rather than claiming conformance from appearance.

## 4. Pooja’s Picks: page sequence and content

### A. Compact hero

Eyebrow: **POOJA’S PICKS**

H1: **Fashion finds, with the details that matter.**

Supporting copy: **Explore my try-ons, fit notes and shopping edits. See what I liked, what I questioned and what I’d wear again.** Use this only where populated records substantiate those experiences.

Primary link: **Browse my picks**, targeting the collection below.

Secondary link: **Seen something on Instagram?**, targeting mapped edits.

Visible disclosure near the first commercial links: **Some links are affiliate links. I may earn a commission if you buy through them.** Link to a fuller explanation. Do not claim prices are unaffected unless confirmed by the programme.

### B. Find the look you came for

Label: **Seen on Instagram? Find the outfit.**

Show recent mapped Reels with the same recognisable cover, a descriptive title and publication date. Each links to a durable edit page. Allow search by product, retailer, edit name or public keyword such as MANGO or WORK. A social keyword identifies content; it should not create a second duplicate review URL.

Avoid loading a full Instagram embed for every item. Use approved thumbnails and load video only after interaction.

### C. Featured edit

Use one editorial image beside a short introduction and three to five linked items. Rotate by genuine editorial update, not on every page refresh. Example topic: **“A week of outfits you can repeat.”** This breaks up the grid without creating a promotional billboard.

### D. Browsable collection

Initial taxonomy:

- Categories: Clothing, Bags, Shoes, Accessories. Clothing can later expose Tops, Trousers, Dresses and Basics.
- Occasions: Everyday, Workwear, Party/occasion, Holiday.
- Retailers: populate from actual records, including Myntra only where real recommendations exist.
- Budget: Under ₹999; ₹999–₹1,998; ₹1,999+. Labels and predicates must agree exactly. Use “Under ₹1,999” as a quick filter if desired; it intentionally overlaps Under ₹999.
- Verdict: Kept, Returned, Good with a caveat, First impression.
- Editorial collections: New this week, Things I kept, Things I returned, Rewear updates.

Do not conflate retailer, category, price and verdict in one flat taxonomy. Do not apply fake budget buckets to unverified prices. Keep priced membership consistent with the displayed last-checked price; indicate that retailer prices can change.

Default sorting: editorially curated or newest published. Only offer price sorting when comparable, verified prices exist. Never invent a Popular sorting metric. Start with a limited set of controls; reveal advanced filters on request.

### E. Product card

Each card needs:

1. Original/approved image and useful alt text.
2. Retailer and product name.
3. Verdict label, where an actual verdict exists.
4. One distinctive observation, drawn from the review.
5. Checked price/date or “Check retailer price” when unverified.
6. **Read my review** and **Check price at [retailer] ↗**.

Do not manufacture example verdicts to fill the page. No fake star ratings, engagement counts, crossed-out prices or Add to cart for affiliate items. Disclose sponsorship/gifting/own-label relationships at appropriate prominence; these are distinct from affiliate status.

The image/title can link to the review. Other actions must be separate valid controls, without nested links or ambiguous whole-card clicks.

### F. Review detail template

Order: breadcrumb → specific title → byline/date → verdict and one-sentence answer → imagery/video → fit and test details → drawbacks → who it suits → styling combinations → retailer link → alternatives → questions → related service invitation.

Useful fields: size worn; Pooja's relevant measurements only if approved; product measurements where available; material/lining; opacity; comfort while sitting and moving; bra compatibility where relevant; care; what was actually tested; number or duration of wears only if recorded.

Separate **first impression**, **worn**, and **wash-tested** evidence. Do not imply Pooja's size guarantees another person's fit. Record what changed in a rewear update and update the visible date only when content materially changes.

For Returned items, lead with the reason and suitability caveat. Recommend an alternative only when there is evidence. Let the owner choose whether the original shopping link remains useful; a return review should not automatically become a sales pitch.

### G. Shop this Reel / curated edit template

Show the relevant outfit first; a short explanation; individual pieces; size/fit notes; and the original post. For mixed looks, label destinations explicitly: **Shop the Label**, **View Closet item**, **Shop at Mango ↗**. Do not offer a combined external checkout. A sold Closet piece can remain in the lookbook with a Sold label and an optional genuinely relevant alternative.

### H. Trust and cross-sell

Add an expandable “How I review” section explaining the actual editorial process. Then a concise service invitation: **“Like the edit, but need it tailored to you?”** → **Explore personal styling**.

Offer an optional weekly-edit subscription separately from the existing Label/Closet drop-list preference. No automatic enrolment, forced signup or interruption before someone reads a review.

### Required states

Loading with reserved image dimensions; no recommendations yet; no filter results with Clear filters; broken/unavailable link; unknown price; sold out; missing image; expired edit; video unavailable; and an older review that remains useful. Never quietly replace a clicked item with a different affiliate destination.

## 5. Personal Styling & Shopping: page sequence and content

The primary audience is someone who likes Pooja’s judgement but needs advice and shopping assistance tailored to their own life. Overseas clients are a supported audience based on prior work; destinations, languages and logistics promises still require confirmation.

### A. Hero with a human presence

Eyebrow: **STYLING WITH POOJA**

H1: **Personal styling & shopping, built around you.**

Supporting copy: **Get help choosing outfits for your wardrobe, your plans and your budget—with personal styling and shopping assistance from Pooja Dugar.**

Audience line: **Enquiries welcome from clients in India and abroad.** Publish only if Pooja confirms current capacity to accept these enquiries.

Primary action: **Tell me what you need** → enquiry form.

Secondary action: **See how it works** → process.

Use an approved portrait or a real working image of Pooja reviewing a rail/lookbook. Keep subject and action visible together on mobile. Do not imply that an AI-generated model is Pooja or a client.

### B. Help visitors recognise their problem

Three brief entry points, displayed as a clean row or list:

- **I need outfits that work together.** Virtual styling and wardrobe planning.
- **I know the occasion, but not what to buy.** A focused outfit and shopping edit.
- **I’m abroad and need help shopping in India.** Discuss sourcing and coordination needs.

Selection scrolls to the relevant offer and can prefill a service interest. It should not lock the visitor into a diagnosis or collect personal data unnecessarily.

### C. Explain the three proposed offers

These are editable draft scopes. Confirm exact deliverables, fees and timelines before making public commitments.

| Offer | Proposed deliverable | Explicit boundary |
|---|---|---|
| Personal Style Edit | Consultation, three complete looks, linked shortlist, one revision | One occasion or defined need |
| Wardrobe & Shopping Edit | Selected wardrobe review, gap list, coordinated shopping shortlist and outfit combinations | Agreed item/look count and revision limit |
| India Shopping Concierge | Brief, sourcing, agreed shopping visits or video sessions and purchase coordination | Visits, items, timeline and logistics quoted individually |

Use **Discuss this service** if prices are not approved. A quote-based service is legitimate; an invented starting price is not. Separate styling fees, clothing, alterations, travel and shipping. Do not describe shipping, customs handling, returns or fitting management as included without an agreed operating process.

### D. Show the process

Five numbered steps with one sentence each:

1. **Share your brief:** country/time zone, occasion, timing, preferences and budget.
2. **Agree the scope:** confirm the deliverables, fee and what is outside the package.
3. **Review your edit:** compare outfit options with the reasons behind them.
4. **Approve next steps:** approve purchases or coordination separately where included.
5. **Receive your outfit plan:** receive the agreed lookbook and bounded follow-up.

Add a small overseas-client note explaining what is remote and what depends on stores, fitting, travel or delivery. Avoid guarantees of fit or arrival dates unsupported by the service.

### E. Demonstrate the deliverable

Show a readable lookbook excerpt: a brief, one outfit, why it was chosen, alternatives and indicative budget composition. Use a genuine permitted client example, or clearly label an authored example **“Sample styling brief — illustrative, not a client result.”** A sample may demonstrate the format but must not carry fabricated product claims or a false success story.

### F. Client evidence

A real case study should include brief, constraints, process, selected outfits, outcome and a permitted quote. No invented names, locations, photos, savings or metrics. If no approved case study exists, omit this public section and show Pooja’s real method and sample deliverable instead. Do not fill the space with fake testimonial cards.

### G. About Pooja and recommendations policy

Connect to the existing About page and creator work. Explain that the service is tailored to the client's preferences and budget. Disclose when own-label products or commission-bearing links are included. Do not claim formal styling qualifications unless supplied.

### H. Service FAQs

Answer the operational questions in section 9 using confirmed facts. Keep main price/scope information visible outside accordions. A question needing an unconfirmed answer stays in the editorial queue rather than shipping invented terms.

### I. Short enquiry form

Required: name; email or another confirmed primary contact channel; country/time zone; service interest; brief description. Include an approximate clothing budget and occasion/deadline where relevant, with “Not sure yet” options. Keep phone optional if email suffices. Explain that clothing budget and service fee are separate. Never request passport details, payment card details, body photos or detailed measurements here.

Use one short form or at most two clear steps. Preserve entered values on validation failures. Show errors next to fields and in an accessible summary. Handle submission, loading, success, duplicate submission and server failure. A success state must mean the enquiry was actually stored or delivered. A delivery failure must not say “Thanks, we’ll be in touch.”

On success show a reference and the next step; publish a response-time commitment only if confirmed. Marketing signup is optional and separate. Do not call the enquiry a booked appointment. A scheduling link can be added later when a real booking system is available.

Use the site's existing protected backend/contact integration. If a connection is missing, build the integration interface and report the exact blocker; never ship a console-only form, fabricated endpoint or silent discard. Private enquiries must not be stored in a public content repository or included in analytics payloads.

### J. Mobile action

After the hero action leaves view, a quiet bottom action may show **Enquire about styling**. Remove it while the form or keyboard is visible. Do not stack it with a WhatsApp bubble and another floating promotion. Use WhatsApp only with the owner's confirmed business destination and appropriate consent; do not invent a number.

## 6. Components and editable content

Reuse the existing component system. Add only reusable components needed by these journeys:

| Component | Responsibility |
|---|---|
| Section navigation | Four destinations, active state, mobile menu |
| Editorial intro | Compact heading, context and primary/secondary action |
| Reel/edit tile | Recognisable content entry linked to a mapped edit |
| Filter bar and sheet | Query state, selected chips, results count, clear/reset |
| Pick card | Product, verdict, observation and correct purchase destination |
| Review summary | Answer, evidence status and commercial disclosure |
| Media viewer | Approved imagery, keyboard controls, captions and optional video |
| Fit and test notes | Readable evidence table/list |
| Complete-look list | Mixed product destinations with explicit ownership |
| Related edit/service invitation | Contextual next action |
| Service comparison | Scope, boundaries and confirmed pricing |
| Process steps | Explain delivery simply |
| Case study/sample | Show real evidence or labelled illustration |
| Question/answer group | Visible, accessible answers |
| Enquiry form | Real submission, validation and feedback |
| Newsletter preference | Separate shopping edits from store-drop emails |
| Empty/error states | Clear recovery without false content |

### Content records

**Pick:** stable ID, slug, title, retailer, category, occasion tags, image rights/source, media, original review, answer summary, evidence stage, verdict, size/fit notes, price/currency/check time, availability/check time, affiliate URL/provider, non-affiliate URL if useful, disclosure flags, author, publication/update dates, related edits, publish status.

**Edit:** stable ID, slug, title, introduction, hero image, ordered item references, related Reel URL/keyword, date, genuine occasion/use case, review links, author, publish status.

**Service:** title, description, deliverables, exclusions, fee or quote mode, timeline if confirmed, availability state, FAQ references, enquiry interest value, publish status.

**Case study:** permission status, approved assets, anonymisation preference, original brief, process, outcome, approved quote, services involved, publication approval.

**Guide:** target question, direct answer, original evidence, sections, author, sources, dates, related reviews/services, video reference, publish status.

**Enquiry:** separate private storage for contact, service interest, country/time zone, budget range, brief, consent flags, lead source and status. Use existing staff access controls; do not broaden access for this feature.

Model products independently from affiliate destinations so a retailer link can change without breaking the review URL. Keep editorial judgments independent of commission rate. Validate URLs, currency and date formats; prevent unsafe links and arbitrary redirects.

Prefer the current CMS/admin. If none exists, propose the smallest maintainable content workflow consistent with the repository. Do not introduce a new SaaS subscription or substantial admin application without a demonstrated need. Provide draft, preview, publish, unpublish and edit paths appropriate to the existing system.

## 7. Hooks and restrained animation

Attention should come from useful proof and recognition. Implement the first four hooks at launch; later items depend on content and demand.

| Hook | Experience | Why it belongs |
|---|---|---|
| Find the Reel | Same recognisable thumbnail leads to exact items | Resolves the visitor's immediate task |
| Verdict before purchase | A useful caveat visible on the card/review | Makes judgement tangible |
| Shop by real-life need | Work, everyday, occasion and budget controls | Reduces browsing effort |
| See your possible deliverable | Readable sample lookbook on styling page | Makes a service concrete |
| Rewear updates | Dated follow-up after genuine use | Gives people a reason to return |
| One piece, several outfits | User-controlled image tabs or next/previous buttons | Demonstrates versatility |
| Ask a shopping question | Route a specific question to enquiry or editorial queue | Reveals real future topics |
| Optional service chooser | Two or three local, deterministic questions recommending a service | Helps uncertain visitors without an email gate |

Do not launch a chatbot merely to appear AI-ready. A useful service chooser can work without an AI model or collecting wardrobe photographs.

### Motion specification

- Buttons and links: 120–180ms colour/underline transitions; obvious focus state.
- Optional alternate product image: 180–240ms crossfade on hover/focus with an explicit tap control on touch. Never hide necessary evidence behind hover.
- Verdict/fit accordions: brief 160–220ms disclosure; maintain focus and correct expanded state.
- Filter changes: short opacity transition, preserve list position, announce new result count. Do not animate every card across the screen.
- Service steps and editorial imagery: at most one restrained entrance, around 240–360ms with a 6–10px translation. Content must remain readable if animation fails.
- Sticky mobile action: one gentle entrance when relevant; no repeated bouncing or pulsing.
- User-controlled outfit comparison: crossfade while keeping labels and dimensions stable.

Honour `prefers-reduced-motion`: remove translation, parallax and nonessential transitions. Never use scroll hijacking, pinned sections that trap reading, autoplay sound, loading intros, fake scarcity, countdowns, cursor followers, or automatically rotating copy that makes the headline hard to read.

## 8. SEO and AEO foundations

This is an evidence-led publishing system, not a keyword-stuffing exercise. No ranking, rich-result or AI-citation guarantees. Recheck current platform documentation at implementation time; references are in section 15.

### Page intent and metadata

| Page | Search intent | Suggested title | Suggested H1 |
|---|---|---|---|
| `/picks` | Browse Pooja's reviewed fashion finds | Pooja’s Picks: Fashion Reviews & Shopping Edits | Fashion finds, with the details that matter. |
| `/picks/products/[slug]` | Decide about an exact product | [Actual product]: Fit Review & Verdict — Pooja Dugar | [Actual product]: my fit and wearability review |
| `/picks/edits/[slug]` | Shop a specific need or look | [Specific edit] — Pooja’s Picks | The actual descriptive edit title |
| `/styling` | Hire styling/shopping assistance | Personal Stylist & Shopper — Pooja Dugar | Personal styling & shopping, built around you. |
| Future virtual service | Hire remote advice | Online Personal Styling with Pooja Dugar | Personal styling, wherever you are |
| Future shopping service | Hire India-based assistance | Personal Shopping in India for Overseas Clients | A personal shopping brief, handled with you |

Dynamic title examples are templates, not literal bracketed public copy. Generate unique, factual descriptions reflecting the page. Main-page example: “Explore Pooja Dugar’s fashion reviews, fit notes and curated shopping edits. Find the items featured in her outfits and see the details before buying.” Service example: “Explore personal styling and shopping with Pooja Dugar. Share your wardrobe needs, occasion and budget to discuss a tailored service.”

### Technical requirements

- Use the existing framework's rendering capabilities so essential reviews, service scope, links and answers are available as meaningful HTML, not only after client-side interaction or login.
- Use a single clear H1, descriptive headings, standard links with real destinations and stable readable URLs.
- Provide canonical URLs, unique metadata and appropriate social sharing previews. Canonicalise tracking-only variants to the clean page.
- Include only approved indexable canonical content in XML sitemaps with truthful modification dates. Exclude private previews, enquiries, internal search and arbitrary filtered variants.
- Make paginated collection pages independently addressable with real links and self-canonicals. A Load more enhancement must not be the only way crawlers can discover products. Do not canonicalise every valid pagination page to page one.
- Treat filter combinations deliberately: launch with normal query-state UI and a documented indexing policy. Internal search and non-editorial filter results should not become thousands of thin landing pages. If using `noindex`, the crawler must be able to fetch it; do not block the same URL in robots.txt and expect that directive to be read. Future crawl blocking is a separate decision after auditing actual URL behaviour.
- Use proper 404s for nonexistent content. Keep useful discontinued reviews with an honest availability note; redirect only when there is a genuinely equivalent replacement.
- Use descriptive image filenames, responsive images, reserved dimensions and human alt text. Do not use alt text as a keyword list.
- Mark affiliate/sponsored outbound links appropriately, such as `rel="sponsored"`; add the relevant new-tab protections when opening a new tab. Preserve valid provider attribution.
- Extend existing structured data without duplicate/conflicting entities. Use real Organisation/Person identity and breadcrumbs; Article for appropriate editorial pages; VideoObject only for real qualifying videos and required fields. Service data can describe a real service but does not promise a Google rich result.
- Evaluate Product/Review structured data against current eligibility and evidence. Do not label TPE as seller of external stock, fabricate aggregate ratings or pretend a personal verdict is a star rating. Accurate schema must match visible content.
- FAQs are useful visible content. Google retired FAQ rich results in May 2026; do not sell FAQPage markup as a current Google rich-result benefit. No special AEO schema or llms.txt ranking requirement.
- Keep mobile load and interaction fast. Aim for field p75 LCP ≤2.5s, INP ≤200ms and CLS ≤0.1. Report lab measurements separately; Lighthouse alone does not prove field INP.
- Load video/third-party embeds on demand; avoid turning every review tile into an external player. Protect the main image from unnecessary lazy loading; lazy-load below-fold media.
- Do not claim international coverage, create country offices or add local business locations without evidence. Start with one honest overseas-client section. Add country pages only for genuinely different service information and proof.

### Answer-first content pattern

For each real question: a direct short answer → supporting explanation → first-hand evidence/example → important limits → useful next action. Keep the answer in visible page content, not only inside an image, video or structured data. Expandable answers must be accessible and present in the page content.

Use named authorship, an About connection, actual experience, original photographs, useful comparisons and truthful dates. Link each guide to the relevant review or service rather than sending every visitor to a generic homepage. Do not create a separate page for every phrasing of the same question.

Maintain consistent identity: Pooja Dugar is the creator/stylist; The Pooja Edit is the website/business brand; Pooja’s Picks is its editorial shopping section; Styling with Pooja is its service. Link only verified social profiles in identity metadata.

## 9. Content and question backlog

These are topics to research and write, not pre-approved factual claims. Populate only when actual evidence or operating decisions support the answer. Keep this backlog editable.

### Picks: original reviews and answers

1. Are these white trousers see-through in daylight?
2. How does this exact Mango dress fit, and what size did Pooja wear?
3. Does this top work with a regular bra?
4. What fits inside this bag, and is the strap comfortable?
5. Would I buy this item again at the price I paid?
6. What changed after wearing or washing it?
7. Why did I keep this item or return it?
8. Who might prefer a different cut or fabric?
9. How can I wear this piece for work and an evening out?
10. Which items make this complete outfit, and where are they sold?
11. What do I check before recommending something?
12. Which links are affiliate links, and how are sponsored products labelled?

### Styling: service answers

1. What does an online personal stylist do?
2. What is the difference between styling and personal shopping?
3. Can I enquire while living abroad?
4. Can you work with clothes I already own?
5. What is included in each package?
6. Is the clothing budget separate from the service fee?
7. How are prices and project scope decided?
8. What happens after I enquire?
9. How are remote fit and measurements handled?
10. Who approves purchases?
11. Do you buy items or only provide links?
12. Who handles returns and exchanges?
13. Are alterations, travel, packing or delivery included?
14. What can be done before a short India shopping trip?
15. How much notice do you need for an occasion?
16. Do you recommend brands other than your own?
17. How many revisions and follow-ups are included?
18. What happens if my brief changes?
19. Can you coordinate communication across time zones?
20. What information stays private, and is photo sharing optional?

### Topic clusters and destinations

| Cluster | Core phrases | Useful content | Destination |
|---|---|---|---|
| Product decisions | Mango dress review, trouser fit review, keep or return | Exact product evidence | Product reviews |
| Wearable edits | Workwear under ₹1,999, everyday bags, party dresses | Original curated selection | Edit pages |
| Rewear | One piece three outfits, capsule wardrobe, outfit repeats | Styling demonstrations | Guides + relevant edits |
| Remote advice | Personal stylist online, virtual styling for women | Process and real deliverable | Virtual service / styling hub |
| Overseas shopping | Personal shopper India, shopping assistance for overseas clients | Scope, approvals and coordination | Shopping service / styling hub |
| Occasion help | Wedding guest outfit stylist, holiday wardrobe planning | Evidence-backed case studies | Relevant service/story |
| Pricing | Personal stylist fees, personal shopper cost | Transparent scope comparison | Packages and FAQ |

Search volume, competition and conversion are not verified. Validate with real enquiries and available search data. Use the separate keyword bank supplied by the owner if available; this brief also stands alone.

### Eight-week publishing sequence

| Week | Website content | Instagram/YouTube adaptation | Business action |
|---|---|---|---|
| 1 | How I review + one actual review | Question → verdict → proof Reel | Visit the exact review |
| 2 | One useful outfit edit | Discovery shortlist, test and final picks | Shop the edit |
| 3 | Styling process + genuine sample deliverable | What do you receive from a stylist? | Service enquiry |
| 4 | Overseas shopping workflow | Can someone shop in India for me? | Discuss the brief |
| 5 | Rewear update | Same item, new occasion, updated verdict | Revisit the review |
| 6 | Approved client story or clearly labelled demonstration | Brief → choices → final outfits | Relevant package enquiry |
| 7 | Budget and service-fee explanation | Clothing budget versus styling fee | Better-qualified enquiry |
| 8 | Fit guide answering repeated questions | Short fit demonstration + longer explanation | Review or consultation |

Do not publish every planned article immediately. Build from real questions and experience. One substantive guide can support several short social answers; preserve the full answer on the website. Original spoken explanations, accurate video captions and useful summaries are more valuable than mechanically repeating keywords.

## 10. Measurement and conversion

Use the current analytics stack; do not install multiple overlapping trackers. Apply existing consent controls. Do not send names, email addresses, phone numbers, body measurements, free-text briefs or private client details to analytics.

Suggested events:

| Event | Trigger | Useful non-sensitive fields |
|---|---|---|
| `pick_review_view` | Review actually viewed | Pick ID, edit ID/source |
| `pick_filter_change` | Filter applied | Category/occasion/budget values |
| `retailer_click` | Deliberate outbound action | Pick ID, retailer, placement, content ID |
| `edit_view` | Curated edit viewed | Edit ID, public campaign source |
| `styling_service_select` | Service interest selected | Service ID |
| `styling_enquiry_start` | Form interaction begins | Entry page/source |
| `styling_enquiry_success` | Backend confirms acceptance | Non-personal request reference if appropriate |
| `styling_enquiry_error` | Submission fails | Error category, never form contents |
| `newsletter_signup_success` | Confirmed subscription step | Preference selected |

Define deduplication and do not fire conversion events merely because someone clicks submit. Ensure outbound navigation works even if analytics is blocked. Affiliate purchase/commission data comes from the provider; the website cannot see another retailer's checkout by itself. Respect provider-supported campaign/sub-ID formats.

Report separately:

- Picks: review visits, outbound-click sessions, outbound click-through, supported attributed orders and approved commission.
- Styling: enquiries, qualified leads, consultations, paid bookings, service contribution and delivery hours.
- Label/Closet: existing store orders and sales.
- Brand ads: spend, attributed purchases, CPA and ROAS only where the advertiser supplies suitable data.

Use voluntary “How did you hear about us?” alongside source tracking. AI referrals and mentions are incomplete signals; occasional prompt checks are diagnostic rather than a stable ranking score.

## 11. Working architecture

Use the existing application to render both destinations from editable public content. Public recommendation records reference external affiliate URLs; they are not inventory. Existing Label/Closet records remain the authority for stock and checkout.

The enquiry form submits to a validated private backend, which records the request and uses an existing confirmed notification channel. Staff view requests through existing access controls or an approved private workflow. Public content and private lead data must remain separated.

Build preview/publish controls that prevent drafts from appearing in navigation, search, sitemaps, public structured data or production feeds. Render metadata from the same content record as the visible page so prices, dates and service details cannot silently diverge.

Use migrations compatible with existing data. Document any required environment settings without printing secrets. Do not scrape retailer sites to fabricate a live stock/price service; launch with owner-checked values and timestamps unless a permitted integration exists.

## 12. Delivery phases

### Phase 1: audit and foundation

Inspect existing code, visual tokens and commerce boundaries. Record the routes/components to extend. Establish schemas and a real-data inventory. Identify essential missing inputs early, in one focused list, while continuing independent work.

### Phase 2: working first release

Implement both main pages, reusable review/edit templates, filters, the service enquiry journey, global links, metadata, essential tracking and error states. Use available approved content; a target such as 12–20 Picks and three or four edits is a content goal, not permission to fabricate records.

### Phase 3: content and operational verification

Verify reviews against supplied evidence, check destinations, approve service scope and confirm an enquiry reaches the intended private system in a safe test. Provide an owner content guide and any unresolved input list.

### Phase 4: measured expansion

Add separate service pages, genuine case studies, richer edits, a service chooser or saved picks only after demand and content support them. Avoid accounts, payments, complex recommendation engines and new subscriptions in the initial release unless separately requested.

## 13. Acceptance checks

The build is complete only when the following relevant checks pass, or remaining blockers are explicitly reported:

- Existing Label/Closet navigation, product detail, stock handling and shared cart remain intact. Test checkout only through available safe/test mechanisms; do not place a real order.
- New routes work by direct load and browser navigation. No dead cards, fake data, empty published articles or broken cross-links.
- A user can find a mapped Reel, read its review and open the intended retailer without confusion about who sells it.
- Filters combine correctly, survive refresh/back navigation where intended and offer a clear reset. Pagination links are crawlable.
- Unknown prices, sold-out items, returned verdicts, empty results and unavailable video behave honestly.
- Service selection, form validation, network failure and confirmed success are verified. No success on failed delivery and no duplicate submissions from repeated taps.
- Private lead data stays private. Owner notifications and marketing consent behave as described.
- Desktop/mobile layout, keyboard operation, focus management, zoom, screen-reader labels and reduced motion are checked.
- Main content, titles, canonicals, sitemaps, indexing rules and structured data match approved records.
- Affiliate links retain provider requirements and appropriate disclosure/link attributes.
- Analytics records real actions once and excludes personal information. Tracking failure cannot block shopping or enquiry.
- Performance is checked on representative mobile conditions. Report lab versus available field evidence accurately.
- Existing repository checks appropriate to the changes pass. Add meaningful tests around the functional risks rather than superficial snapshots of static copy.

Return: implemented route list; preview link; desktop/mobile screenshots; summary of checks; CMS/content instructions; exact remaining blockers; and the steps needed for authorised publication. Do not describe a static mockup as a working integration.

## 14. Owner inputs to resolve without inventing

Group these requests; do not repeatedly interrupt for routine design decisions:

1. Approved images, product identities, first-hand review notes, affiliate links and permitted placements.
2. Actual service deliverables, fees or quote approach, supported regions, notice periods, revisions and operational limits.
3. Confirmed contact/notification destination and, if relevant, scheduling or business WhatsApp details.
4. Approved portrait, biography, client stories and marketing permissions.
5. Existing newsletter preferences, analytics setup and authorised access to the project.

If content is missing, complete the reusable implementation and keep unapproved records private. Provide a specific input list. Do not turn missing testimonials into fake testimonials or missing prices into invented prices. A public launch depends on enough approved content and working enquiry handling.

## 15. Research references and current limits

- Existing website, inspected directly: https://thepoojaedit.in/
- Google guidance on generative search: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google documentation updates, including FAQ rich-result retirement in May 2026: https://developers.google.com/search/updates
- Faceted navigation: https://developers.google.com/crawling/docs/faceted-navigation
- Pagination: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Product snippet requirements: https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- Video structured data: https://developers.google.com/search/docs/appearance/structured-data/video
- Qualifying commercial outbound links: https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
- Search spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Core Web Vitals: https://web.dev/articles/vitals
- Existing affiliate provider terms: https://creators.lehlah.club/terms-and-conditions.html

These sources inform the technical requirements; the page structure, proposed copy, interaction design and business workflow are recommendations for this project. No source establishes Pooja's service prices, credentials, client results or future rankings. Confirm any platform-specific requirements again when implementing.
