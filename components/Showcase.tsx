"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { InstagramItem, ShowcaseData } from "@/lib/types";
import { pricing, site, waLink, type PriceKey } from "@/lib/site";
import { EmptyState, GraphicCard, InstagramCard, ModalProvider, YouTubeCard } from "./Media";
import { ChatPanel } from "./ChatPanel";
import { ArrowIcon, WhatsAppIcon } from "./icons";

const TABS = [
  { id: "reels", label: "Instagram Reels" },
  { id: "youtube", label: "YouTube Long Form" },
  { id: "carousels", label: "Instagram Carousels" },
  { id: "graphics", label: "Graphics" },
  { id: "chat", label: "Chat With Us" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const isTab = (s: string): s is TabId => TABS.some((t) => t.id === s);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Showcase({ data }: { data: ShowcaseData }) {
  const [active, setActive] = useState<TabId>("reels");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // Deep-linking: #youtube, #chat, etc. Footer/CTA links can switch tabs too.
  useEffect(() => {
    const sync = () => {
      const h = location.hash.slice(1);
      if (isTab(h)) setActive(h);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Sliding capsule highlight behind the active tab.
  useIsoLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[active];
      const list = listRef.current;
      if (!el || !list) return;
      setPill({ x: el.offsetLeft, w: el.offsetWidth });
      // Keep the active capsule visible on narrow screens without scrolling the page.
      const target = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2;
      list.scrollTo({ left: target, behavior: "smooth" });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  const select = (id: TabId, focus = false) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    const el = tabRefs.current[id];
    if (focus) el?.focus({ preventScroll: true });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === active);
    const n = TABS.length;
    const next =
      e.key === "ArrowRight" ? (i + 1) % n
      : e.key === "ArrowLeft" ? (i - 1 + n) % n
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    select(TABS[next].id, true);
  };

  return (
    <ModalProvider>
      <section id="work" className="showcase" aria-label="Portfolio">
        <div className="tabs-wrap">
          <div className="tabs" role="tablist" aria-label="Services" ref={listRef} onKeyDown={onKey}>
            {pill && (
              <span
                className="tab-pill"
                aria-hidden="true"
                style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
              />
            )}
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={active === t.id ? 0 : -1}
                className={`tab ${active === t.id ? "is-active" : ""} ${t.id === "chat" ? "tab-chat" : ""}`}
                onClick={() => select(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          key={active}
          className="panel"
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          tabIndex={0}
        >
          {active === "reels" && <ReelsPanel reels={data.reels} carousels={data.carousels} />}
          {active === "youtube" && <YouTubePanel data={data} />}
          {active === "carousels" && <CarouselsPanel items={data.carousels} />}
          {active === "graphics" && <GraphicsPanel data={data} />}
          {active === "chat" && <ChatPanel />}
        </div>
      </section>
    </ModalProvider>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */

function PanelHead({ title, sub, priceKey }: { title: string; sub: string; priceKey: PriceKey }) {
  const p = pricing[priceKey];
  return (
    <header className="panel-head">
      <div>
        <h2 className="h2">{title}</h2>
        <p className="lede">{sub}</p>
      </div>
      <div className="price-block">
        <p className="price-amount">
          <strong>{p.amount}</strong>
          <span>{p.unit}</span>
        </p>
        <p className="price-includes">{p.includes}</p>
        <a
          className="btn btn-wa btn-sm"
          href={waLink(`Hi Pooja! I'd like to book ${p.service} (${p.amount} ${p.unit}).`)}
          target="_blank"
          rel="noopener"
        >
          <WhatsAppIcon size={16} /> Book on WhatsApp
        </a>
      </div>
    </header>
  );
}

function Filters<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; count: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`chip ${value === o.id ? "is-active" : ""}`}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          <span className="chip-count">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function SourceNote({ sample }: { sample: boolean }) {
  if (!sample) return null;
  return (
    <p className="source-note">
      Showing sample tiles. Real posts appear automatically once the Instagram token is connected, or when posts are
      added to <code>content/instagram.json</code>.
    </p>
  );
}

/* ───────────────────────── Tab 1: Reels ───────────────────────── */

type ReelFilter = "all" | "brand" | "carousel" | "affiliate" | "ugc";

function ReelsPanel({ reels, carousels }: { reels: InstagramItem[]; carousels: InstagramItem[] }) {
  const [filter, setFilter] = useState<ReelFilter>("all");
  const all = useMemo(() => [...reels, ...carousels], [reels, carousels]);
  const by = (c: InstagramItem["category"]) => all.filter((i) => i.category === c);

  const options: { id: ReelFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: reels.length },
    { id: "brand", label: "Brand Reels", count: by("brand").length },
    { id: "carousel", label: "Carousels", count: carousels.length },
    { id: "affiliate", label: "Affiliate", count: by("affiliate").length },
    { id: "ugc", label: "UGC", count: by("ugc").length },
  ];
  const items = filter === "all" ? reels : filter === "carousel" ? carousels : by(filter);

  return (
    <>
      <PanelHead
        title="Instagram Reels Editing"
        sub="Scroll-stopping Reels, branded edits, affiliate content, and UGC."
        priceKey="reels"
      />
      <Filters label="Filter Reels" options={options} value={filter} onChange={setFilter} />
      <SourceNote sample={all.some((i) => i.sample)} />
      {items.length ? (
        <div key={filter} className={`grid ${filter === "carousel" ? "grid-carousel" : "grid-reels"} fade-in`}>
          {items.map((r, i) => (
            <InstagramCard key={r.id} item={r} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState href={site.instagramUrl}>Nothing in this category yet.</EmptyState>
      )}
    </>
  );
}

/* ───────────────────────── Tab 2: YouTube ───────────────────────── */

function YouTubePanel({ data }: { data: ShowcaseData }) {
  return (
    <>
      <PanelHead
        title="YouTube Long-Form Editing"
        sub="Retention-focused edits, thumbnails, and Shorts repurposing."
        priceKey="youtube"
      />
      <h3 className="sub-h">
        Long-form <span>{data.longForm.length}</span>
      </h3>
      {data.longForm.length ? (
        <div className="grid grid-video">
          {data.longForm.map((v) => (
            <YouTubeCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState>Videos will appear here once the channel feed loads.</EmptyState>
      )}

      <h3 className="sub-h" id="shorts">
        Shorts <span>{data.shorts.length}</span>
      </h3>
      {data.shorts.length ? (
        <div className="grid grid-reels">
          {data.shorts.map((v) => (
            <YouTubeCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <EmptyState>Shorts will appear here once the channel feed loads.</EmptyState>
      )}
      <p className="more">
        <a href={site.youtubeUrl} target="_blank" rel="noopener">
          See the full channel {site.youtubeHandle} <ArrowIcon size={16} />
        </a>
      </p>
    </>
  );
}

/* ───────────────────────── Tab 3: Carousels ───────────────────────── */

function CarouselsPanel({ items }: { items: InstagramItem[] }) {
  const labels = ["Educational", "Brand", "Lifestyle", "UGC", "Promotional"];
  const [filter, setFilter] = useState("all");
  const options = [
    { id: "all", label: "All", count: items.length },
    ...labels
      .map((l) => ({ id: l, label: l, count: items.filter((i) => i.carouselLabel === l).length }))
      .filter((o) => o.count > 0),
  ];
  const shown = filter === "all" ? items : items.filter((i) => i.carouselLabel === filter);

  return (
    <>
      <PanelHead
        title="Instagram Carousel Design"
        sub="Clean, high-converting carousels for education, branding, and storytelling."
        priceKey="carousels"
      />
      {options.length > 2 && <Filters label="Filter carousels" options={options} value={filter} onChange={setFilter} />}
      <SourceNote sample={items.some((i) => i.sample)} />
      {shown.length ? (
        <div key={filter} className="grid grid-carousel fade-in">
          {shown.map((c, i) => (
            <InstagramCard key={c.id} item={c} index={i + 3} />
          ))}
        </div>
      ) : (
        <EmptyState href={site.instagramUrl}>Carousels coming soon.</EmptyState>
      )}
    </>
  );
}

/* ───────────────────────── Tab 4: Graphics ───────────────────────── */

function GraphicsPanel({ data }: { data: ShowcaseData }) {
  const cats = ["Thumbnail", "Poster", "Social Creative", "Brand Graphic", "Event Creative"];
  const [filter, setFilter] = useState("all");
  const options = [
    { id: "all", label: "All", count: data.graphics.length },
    ...cats
      .map((c) => ({ id: c, label: c, count: data.graphics.filter((g) => g.category === c).length }))
      .filter((o) => o.count > 0),
  ];
  const shown = filter === "all" ? data.graphics : data.graphics.filter((g) => g.category === filter);
  const sample = data.graphics.some((g) => g.sample);

  return (
    <>
      <PanelHead
        title="Graphics & Creative Design"
        sub="Thumbnails, posters, social creatives, and brand visuals that get attention."
        priceKey="graphics"
      />
      <Filters label="Filter graphics" options={options} value={filter} onChange={setFilter} />
      {sample && (
        <p className="source-note">
          Sample tiles — drop images into <code>public/graphics/</code> and list them in{" "}
          <code>content/graphics.json</code>.
        </p>
      )}
      <div key={filter} className="masonry fade-in">
        {shown.map((g, i) => (
          <GraphicCard key={g.id} item={g} index={i} />
        ))}
      </div>
    </>
  );
}
