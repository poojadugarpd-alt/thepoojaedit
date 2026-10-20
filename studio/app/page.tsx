import { getShowcase } from "@/lib/content";
import { site, waLink } from "@/lib/site";
import { Showcase } from "@/components/Showcase";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { BagProvider } from "@/components/Bag";
import { ModalProvider } from "@/components/Media";
import { ProductGrid, ReelsLove, ShopNow, type LoveItem } from "@/components/Shop";
import { Footer } from "@/components/Footer";
import { WhatsAppIcon } from "@/components/icons";
import { commonFaqs } from "@/lib/services";

// Re-fetch Instagram + YouTube at most once an hour (ISR).
export const revalidate = 3600;

const perks = [
  ["24–48h delivery", "reels, carousels & graphics. youtube in 2–3 days."],
  ["1–2 revisions", "included on every order."],
  ["platform-ready", "exported for instagram, youtube & shorts."],
  ["bulk discounts", "monthly packages & optional rush delivery."],
];

const steps = [
  ["share", "send raw footage, references, brand assets, captions & preferred music."],
  ["edit", "receive a styled edit tailored to your niche."],
  ["review", "watch it and request revisions."],
  ["deliver", "get platform-ready files."],
];

const homeFaqs = [
  {
    q: "how fast will i get my edit?",
    a: "reels, carousels and graphics are ready in 24–48 hours. youtube videos take 2–3 days.",
  },
  {
    q: "what do you edit?",
    a: "instagram reels and shorts, youtube long-form videos, instagram carousels and graphics such as thumbnails and posters, mostly for fashion and lifestyle creators and brands.",
  },
  ...commonFaqs,
];

const hq = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const maxres = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

export default async function Home() {
  const data = await getShowcase();
  const reviews = data.testimonials.filter((t) => !t.sample);
  const s = data.shorts;
  const lf = data.longForm;

  // Real Instagram Reels (with covers) take priority; YouTube Shorts fill in otherwise.
  const igReels = data.reels.filter((r) => !r.sample && r.thumbnailUrl);
  const loveItems: LoveItem[] = igReels.length
    ? igReels.map((r) => ({
        kind: "instagram",
        id: r.id,
        title: r.caption,
        thumb: r.thumbnailUrl!,
        permalink: r.permalink,
        video: r.videoUrl,
      }))
    : s.map((v) => ({ kind: "youtube", id: v.id, title: v.title, thumb: hq(v.id) }));

  const productImages = {
    reels: igReels[0] ? [igReels[0].thumbnailUrl!] : s[0] ? [hq(s[0].id)] : [],
    youtube: lf[0] ? [maxres(lf[0].id)] : [],
    // Instagram-only imagery for Instagram products; YouTube thumbnails stay on YouTube/graphics.
    carousels: (igReels.length >= 3 ? igReels.slice(3, 6).map((r) => r.thumbnailUrl!) : []),
    graphics: lf[1] ? [maxres(lf[1].id)] : [],
  };
  // Brands tagged in the Reels shown on this page (public on Instagram), most-featured first.
  const brandCounts = new Map<string, number>();
  for (const r of igReels) if (r.brand) brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
  const brands = [...brandCounts].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  const heroShots = igReels.slice(1, 4).map((r) => ({ id: r.id, src: r.thumbnailUrl! }));
  const ytFeature = lf.find((v) => /story|tour/i.test(v.title)) ?? lf[0];

  return (
    <BagProvider>
      <ModalProvider>
        <Header />

        <main id="top">
          {/* ── Hero banner ── */}
          <section className="banner banner-hero" aria-labelledby="hero-title">
            <div className="banner-copy">
              <p className="kicker">best-selling</p>
              <h1 id="hero-title" className="display">
                cinematic edits for creators
              </h1>
              <p className="banner-text">
                instagram reels, youtube videos, shorts, carousels & graphics for fashion and lifestyle creators and
                brands — edited to capture attention and drive action.
              </p>
              <div className="banner-ctas">
                <a className="btn btn-wa" href={waLink()} target="_blank" rel="noopener">
                  <WhatsAppIcon size={18} /> chat on whatsapp
                </a>
                <a className="btn btn-white" href="#shop">
                  shop now
                </a>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              {heroShots.map((v, i) => (
                <img
                  key={v.id}
                  className={`hero-shot hs-${i}`}
                  src={v.src}
                  alt=""
                  fetchPriority={i === 1 ? "high" : "auto"}
                  decoding="async"
                />
              ))}
            </div>
          </section>

          {/* ── Best sellers ── */}
          <section className="block" id="shop" aria-labelledby="shop-title">
            <h2 id="shop-title" className="section-title">
              best sellers
            </h2>
            <ProductGrid images={productImages} />
            <p className="fine">
              ₹200 reels are starter edits. premium reels with advanced motion graphics, sound design, colour grading
              and stronger hook editing are quoted separately.
            </p>
          </section>

          {/* ── Brands ── */}
          {brands.length > 0 && (
            <section className="brands" aria-labelledby="brands-title">
              <h2 id="brands-title" className="brands-title">
                brands i&rsquo;ve edited for
              </h2>
              <ul className="brands-list">
                {brands.map((b) => (
                  <li key={b}>
                    <a href={`https://www.instagram.com/${b.replace(/^@/, "")}/`} target="_blank" rel="noopener">
                      {b}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Reels love ── */}
          {loveItems.length > 0 && (
            <section className="block blush" aria-labelledby="love-title">
              <h2 id="love-title" className="section-title">
                {igReels.length ? "reels love" : "shorts love"}
              </h2>
              <ReelsLove items={loveItems} />
            </section>
          )}

          {/* ── Split banner: YouTube ── */}
          {ytFeature && (
            <section className="split" aria-labelledby="yt-title">
              <a className="split-media" href="#youtube" aria-label="See YouTube work">
                <img src={maxres(ytFeature.id)} alt="" loading="lazy" decoding="async" />
              </a>
              <div className="split-copy">
                <p className="kicker">shorts + thumbnail included</p>
                <h2 id="yt-title" className="display display-md">
                  youtube long-form
                </h2>
                <p className="banner-text">
                  retention-focused edits for your channel — every video comes with a custom thumbnail and shorts
                  clippings.
                </p>
                <p className="split-price">₹1,000 per video</p>
                <ShopNow id="youtube" label="add to bag" />
              </div>
            </section>
          )}

          {/* ── Perks strip ── */}
          <section className="perks" aria-label="What's included">
            {perks.map(([t, d]) => (
              <div key={t} className="perk">
                <p className="perk-title">{t}</p>
                <p className="perk-text">{d}</p>
              </div>
            ))}
          </section>

          {/* ── Shop the work (the five tabs) ── */}
          <div className="block" aria-labelledby="work-title">
            <h2 id="work-title" className="section-title">
              shop by category
            </h2>
            <Showcase data={data} />
          </div>

          {/* ── How it works ── */}
          <section className="block blush" id="process" aria-labelledby="process-title">
            <h2 id="process-title" className="section-title">
              how it works
            </h2>
            <ol className="steps">
              {steps.map(([t, d], i) => (
                <Reveal as="li" key={t} className="step" delay={i * 80}>
                  <span className="step-num">{i + 1}</span>
                  <p className="step-title">{t}</p>
                  <p className="step-text">{d}</p>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* ── Who edits your videos ── */}
          <section className="block" aria-labelledby="about-title">
            <div className="about-editor">
              <h2 id="about-title" className="section-title">
                who edits your videos
              </h2>
              <p>
                i&rsquo;m pooja dugar, a fashion and lifestyle creator on instagram ({site.instagramHandle}) and
                youtube ({site.youtubeHandle}). i edit my own reels and youtube videos, and brand reels, affiliate
                content and ugc for the brands i work with.
              </p>
              <p>
                i also run{" "}
                <a href="https://thepoojaedit.in" className="text-link">
                  the pooja edit
                </a>
                , my clothing label and pre-loved closet.{" "}
                <a href="https://thepoojaedit.in/about" className="text-link">
                  more about me
                </a>
              </p>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="block blush" id="faq" aria-labelledby="faq-title">
            <h2 id="faq-title" className="section-title">
              questions
            </h2>
            <dl className="faq">
              {homeFaqs.map((f) => (
                <div key={f.q} className="faq-item">
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Reviews: hidden until there are real (non-placeholder) testimonials ── */}
          {reviews.length > 0 && (
            <section className="block" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="section-title">
              reviews
            </h2>
            <p className="center-sub">edited for creators, brands, and lifestyle content</p>
            <div className="reviews">
              {reviews.map((t, i) => (
                <Reveal as="figure" key={i} className="review" delay={i * 80}>
                  <p className="stars" aria-label="5 out of 5 stars">
                    ★★★★★
                  </p>
                  <blockquote>{t.quote}</blockquote>
                  <figcaption>
                    {t.name} · {t.role}
                    {t.sample && <span className="tag tag-inline">placeholder</span>}
                  </figcaption>
                </Reveal>
              ))}
            </div>
            </section>
          )}
        </main>

        <Footer />

        <a className="wa-fab" href={waLink()} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
          <WhatsAppIcon size={26} />
        </a>
      </ModalProvider>
    </BagProvider>
  );
}
