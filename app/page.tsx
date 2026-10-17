import { getShowcase } from "@/lib/content";
import { site, waLink } from "@/lib/site";
import { Showcase } from "@/components/Showcase";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { BagProvider } from "@/components/Bag";
import { ModalProvider } from "@/components/Media";
import { ProductGrid, ReelsLove, ShopNow } from "@/components/Shop";
import { InstagramIcon, MailIcon, WhatsAppIcon, YouTubeIcon } from "@/components/icons";

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

const hq = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const maxres = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

export default async function Home() {
  const data = await getShowcase();
  const s = data.shorts;
  const lf = data.longForm;
  const year = new Date().getFullYear();

  const productImages = {
    reels: s[0] ? [hq(s[0].id)] : [],
    youtube: lf[0] ? [maxres(lf[0].id)] : [],
    carousels: s.slice(3, 6).map((v) => hq(v.id)),
    graphics: lf[1] ? [maxres(lf[1].id)] : [],
  };
  const heroShorts = s.slice(1, 4);
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
                reels, youtube videos, shorts, carousels & graphics — edited to capture attention and drive action.
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
              {heroShorts.map((v, i) => (
                <img
                  key={v.id}
                  className={`hero-shot hs-${i}`}
                  src={hq(v.id)}
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

          {/* ── Reels love ── */}
          {s.length > 0 && (
            <section className="block blush" aria-labelledby="love-title">
              <h2 id="love-title" className="section-title">
                shorts love
              </h2>
              <ReelsLove shorts={s} />
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

          {/* ── Reviews ── */}
          <section className="block" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="section-title">
              reviews
            </h2>
            <p className="center-sub">edited for creators, brands, and lifestyle content</p>
            <div className="reviews">
              {data.testimonials.map((t, i) => (
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
        </main>

        <footer className="footer">
          <div className="footer-cta">
            <p className="display display-sm">have footage in your camera roll?</p>
            <a className="btn btn-wa" href={waLink()} target="_blank" rel="noopener">
              <WhatsAppIcon size={18} /> chat on whatsapp
            </a>
          </div>
          <div className="footer-grid">
            <div>
              <p className="footer-head">shop</p>
              <a href="#reels">instagram reels</a>
              <a href="#youtube">youtube long form</a>
              <a href="#carousels">instagram carousels</a>
              <a href="#graphics">graphics</a>
            </div>
            <div>
              <p className="footer-head">help</p>
              <a href="#process">how it works</a>
              <a href="#shop">pricing</a>
              <a href="#chat">contact us</a>
            </div>
            <div>
              <p className="footer-head">connect</p>
              <a href={site.instagramUrl} target="_blank" rel="noopener">
                <InstagramIcon size={16} /> {site.instagramHandle}
              </a>
              <a href={site.youtubeUrl} target="_blank" rel="noopener">
                <YouTubeIcon size={16} /> {site.youtubeHandle}
              </a>
              <a href={waLink()} target="_blank" rel="noopener">
                <WhatsAppIcon size={16} /> {site.whatsappDisplay}
              </a>
              <a href={`mailto:${site.email}`}>
                <MailIcon size={16} /> {site.email}
              </a>
            </div>
          </div>
          <p className="footer-logo" aria-hidden="true">
            POOJA DUGAR
          </p>
          <p className="copyright">
            © {year} {site.name}. all rights reserved.
          </p>
        </footer>

        <a className="wa-fab" href={waLink()} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
          <WhatsAppIcon size={26} />
        </a>
      </ModalProvider>
    </BagProvider>
  );
}
