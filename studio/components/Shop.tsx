"use client";

import type { PriceKey } from "@/lib/site";
import { inr, products } from "@/lib/products";
import { AddToBag, useBag } from "./Bag";
import { type PreviewSource, useHoverPlay, useModal, VideoPreview } from "./Media";
import { PlayIcon } from "./icons";

/** Product grid: each service is a product with an add-to-bag button. */
export function ProductGrid({ images }: { images: Partial<Record<PriceKey, string[]>> }) {
  return (
    <div className="products">
      {products.map((p) => {
        const imgs = images[p.id] ?? [];
        return (
          <article key={p.id} className="product">
            <a href={`#${p.workTab}`} className={`product-media pm-${p.id}`} aria-label={`See ${p.name} examples`}>
              {p.id === "carousels" && imgs.length >= 3 ? (
                <span className="stack" aria-hidden="true">
                  {imgs.slice(0, 3).map((src) => (
                    <img key={src} src={src} alt="" loading="lazy" decoding="async" />
                  ))}
                </span>
              ) : imgs[0] ? (
                <img src={imgs[0]} alt="" loading="lazy" decoding="async" />
              ) : null}
              {p.badge && <span className="tag">{p.badge}</span>}
              <span className="product-hover">see examples</span>
            </a>
            <div className="product-info">
              <h3 className="product-name">{p.name}</h3>
              <p className="product-tagline">{p.tagline}</p>
              <p className="product-price">
                <strong>{inr(p.price)}</strong> <span>{p.unit}</span>
              </p>
              <p className="product-meta">ready in {p.turnaround}</p>
            </div>
            <AddToBag id={p.id} className="btn-block" />
          </article>
        );
      })}
    </div>
  );
}

export type LoveItem =
  | { kind: "youtube"; id: string; title: string; thumb: string }
  | { kind: "instagram"; id: string; title: string; thumb: string; permalink: string; video?: string };

/** "reels love" — horizontal scroller of vertical videos; hover plays, click opens, bag icon quick-adds. */
export function ReelsLove({ items }: { items: LoveItem[] }) {
  return (
    <div className="love-row" role="list">
      {items.map((v) => (
        <LoveCard key={v.id} item={v} />
      ))}
    </div>
  );
}

function LoveCard({ item: v }: { item: LoveItem }) {
  const open = useModal();
  const bag = useBag();
  const { active, handlers } = useHoverPlay();
  const source: PreviewSource | undefined =
    v.kind === "youtube" ? { kind: "youtube", id: v.id } : v.video ? { kind: "mp4", src: v.video } : undefined;
  return (
    <div className="love-card" role="listitem" {...handlers}>
      <span className="love-media">
        <img src={v.thumb} alt="" loading="lazy" decoding="async" />
        <VideoPreview source={source} active={active} />
        <span className={`love-play-icon ${active && source ? "is-hidden" : ""}`} aria-hidden="true">
          <PlayIcon size={20} />
        </span>
        <span className="love-caption">{v.title.replace(/#\S+/g, "").trim()}</span>
      </span>
      <button
        type="button"
        className="card-hit"
        onClick={() =>
          v.kind === "youtube"
            ? open({ type: "youtube", id: v.id, title: v.title, vertical: true })
            : open({ type: "instagram", permalink: v.permalink, title: v.title })
        }
        aria-label={`Play: ${v.title}`}
      />
      <button
        type="button"
        className="love-bag"
        onClick={() => bag.add("reels")}
        aria-label="Add an Instagram Reel edit to bag"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M5 8h14l-1 12H6L5 8Z" strokeLinejoin="round" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      </button>
    </div>
  );
}

export function ShopNow({ id, label = "shop now" }: { id: PriceKey; label?: string }) {
  const bag = useBag();
  return (
    <button type="button" className="btn btn-white" onClick={() => bag.add(id)}>
      {label}
    </button>
  );
}
