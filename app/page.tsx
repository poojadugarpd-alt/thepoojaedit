import { getShowcase } from "@/lib/content";
import { pricing, site, waLink } from "@/lib/site";
import { Showcase } from "@/components/Showcase";
import { Reveal } from "@/components/Reveal";
import { ArrowIcon, CheckIcon, InstagramIcon, MailIcon, WhatsAppIcon, YouTubeIcon } from "@/components/icons";

// Re-fetch Instagram + YouTube at most once an hour (ISR).
export const revalidate = 3600;

const compact = (n?: number) =>
  n == null ? undefined : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const services = [
  { name: "Instagram Reels", price: "₹200", unit: "per Reel" },
  { name: "YouTube Long Form", price: "₹1,000", unit: "per video" },
  { name: "Instagram Carousels", price: "₹200", unit: "per carousel" },
  { name: "Graphics", price: "₹500", unit: "per graphic" },
  { name: "YouTube Shorts clipping", price: "Included", unit: "with long-form" },
  { name: "Thumbnail design", price: "Included", unit: "with long-form" },
];

const steps = [
  ["Share", "Send raw footage, references, and brand assets — Drive, WeTransfer, or WhatsApp."],
  ["Edit", "Receive a styled edit tailored to your niche, pacing, and audience."],
  ["Review", "Watch it, leave notes, and request revisions. 1–2 rounds included."],
  ["Deliver", "Get platform-ready files, sized and exported for where they’ll live."],
];

const details = [
  "Turnaround: Reels, carousels, and graphics in 24–48 hours; YouTube long-form in 2–3 days.",
  "Includes 1–2 rounds of revisions.",
  "Send raw footage, references, brand assets, captions, and preferred music.",
  "Final files delivered in platform-ready formats.",
  "Bulk and monthly package discounts available.",
  "Optional rush delivery on request.",
];

export default async function Home() {
  const data = await getShowcase();
  const ig = compact(data.stats.instagramFollowers);
  const yt = compact(data.stats.youtubeSubscribers);
  const year = new Date().getFullYear();

  return (
    <>
      <header className="topbar">
        <a href="#top" className="wordmark" aria-label={`${site.name} — home`}>
          Pooja <em>Dugar</em>
        </a>
        <a className="btn btn-wa btn-sm" href={waLink()} target="_blank" rel="noopener">
          <WhatsAppIcon size={17} />
          <span>Chat on WhatsApp</span>
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="spot spot-a" aria-hidden="true" />
          <div className="spot spot-b" aria-hidden="true" />
          <div className="hero-inner">
            <p className="eyebrow">
              <span className="dot" aria-hidden="true" /> Now booking<span className="hide-sm"> · Video editing & content repurposing</span>
            </p>
            <h1 id="hero-title" className="hero-title">
              Cinematic edits for creators who want to <em>stand out</em>
            </h1>
            <p className="hero-sub">
              Reels, YouTube videos, Shorts, carousels, and graphics—edited to capture attention and drive action.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-wa btn-lg" href={waLink()} target="_blank" rel="noopener">
                <WhatsAppIcon />
                Chat on WhatsApp
              </a>
              <a className="btn btn-ghost btn-lg" href="#work">
                View Work <ArrowIcon />
              </a>
            </div>
          </div>
        </section>

        <Showcase data={data} />

        <section className="strip" aria-label="Services">
          <div className="strip-track">
            {[0, 1].map((dup) => (
              <ul key={dup} aria-hidden={dup === 1 || undefined}>
                {services.map((s) => (
                  <li key={s.name}>
                    <span className="strip-name">{s.name}</span>
                    <span className="strip-price">{s.price}</span>
                    <span className="strip-unit">{s.unit}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <Reveal className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title" className="h2">
              Simple, per-piece <em>pricing</em>
            </h2>
            <p className="lede">No retainers required. Pay per edit, or ask about monthly packages.</p>
          </Reveal>

          <div className="price-grid">
            {Object.entries(pricing).map(([key, p], i) => (
              <Reveal key={key} className="price-card" delay={i * 80}>
                <p className="price-service">{p.service}</p>
                <p className="price-amount">
                  <strong>{p.amount}</strong>
                  <span>{p.unit}</span>
                </p>
                <p className="price-includes">{p.includes}</p>
                <p className="price-tat">Turnaround · {p.turnaround}</p>
                <a
                  className="price-link"
                  href={waLink(`Hi Pooja! I'm interested in ${p.service} (${p.amount} ${p.unit}).`)}
                  target="_blank"
                  rel="noopener"
                >
                  Book on WhatsApp <ArrowIcon size={16} />
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal className="price-details">
            <ul>
              {details.map((d) => (
                <li key={d}>
                  <CheckIcon className="tick" />
                  {d}
                </li>
              ))}
            </ul>
            <p className="price-note">
              ₹200 Reels are starter edits. Premium Reels with advanced motion graphics, sound design, colour grading,
              and stronger hook editing can be quoted separately.
            </p>
          </Reveal>
        </section>

        <section className="section" id="process" aria-labelledby="process-title">
          <Reveal className="section-head">
            <p className="eyebrow">Process</p>
            <h2 id="process-title" className="h2">
              From raw footage to <em>ready to post</em>
            </h2>
          </Reveal>
          <ol className="steps">
            {steps.map(([t, d], i) => (
              <Reveal as="li" key={t} className="step" delay={i * 90}>
                <span className="step-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="section trust" aria-labelledby="trust-title">
          <Reveal className="section-head">
            <p className="eyebrow">Trusted work</p>
            <h2 id="trust-title" className="h2">
              Edited for creators, brands, and <em>lifestyle</em> content
            </h2>
          </Reveal>

          <Reveal className="stats">
            <div>
              <strong>{ig ?? "Fashion · Lifestyle"}</strong>
              <span>{ig ? "Instagram followers" : "Core niches"}</span>
            </div>
            <div>
              <strong>{yt ?? `${data.longForm.length + data.shorts.length}+`}</strong>
              <span>{yt ? "YouTube subscribers" : "Recent YouTube uploads"}</span>
            </div>
            <div>
              <strong>24–48h</strong>
              <span>Typical Reel turnaround</span>
            </div>
          </Reveal>

          <div className="quotes">
            {data.testimonials.map((t, i) => (
              <Reveal as="figure" key={i} className="quote" delay={i * 90}>
                <blockquote>“{t.quote}”</blockquote>
                <figcaption>
                  <span>{t.name}</span> · {t.role}
                  {t.sample && <span className="badge badge-muted">Placeholder</span>}
                </figcaption>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="cta-band" aria-labelledby="cta-title">
          <div className="spot spot-c" aria-hidden="true" />
          <Reveal>
            <h2 id="cta-title" className="h2">
              Have footage sitting in your camera roll?
            </h2>
            <p className="lede">Send it over. You’ll hear back the same day.</p>
            <a className="btn btn-wa btn-lg" href={waLink()} target="_blank" rel="noopener">
              <WhatsAppIcon />
              Chat on WhatsApp
            </a>
          </Reveal>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <p className="wordmark">
              Pooja <em>Dugar</em>
            </p>
            <p className="footer-tag">Video editing & content repurposing for creators and brands.</p>
          </div>
          <ul className="footer-links">
            <li>
              <a href={site.instagramUrl} target="_blank" rel="noopener">
                <InstagramIcon size={18} /> {site.instagramHandle}
              </a>
            </li>
            <li>
              <a href={site.youtubeUrl} target="_blank" rel="noopener">
                <YouTubeIcon size={18} /> {site.youtubeHandle}
              </a>
            </li>
            <li>
              <a href={waLink()} target="_blank" rel="noopener">
                <WhatsAppIcon size={18} /> {site.whatsappDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`}>
                <MailIcon size={18} /> {site.email}
              </a>
            </li>
          </ul>
        </div>
        <p className="copyright">
          © {year} {site.name}. All rights reserved.
        </p>
      </footer>

      <a className="wa-fab" href={waLink()} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
        <WhatsAppIcon size={26} />
      </a>
    </>
  );
}
