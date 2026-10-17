"use client";

import type { PriceKey } from "@/lib/site";
import type { YouTubeVideo } from "@/lib/types";
import { inr, products } from "@/lib/products";
import { AddToBag, useBag } from "./Bag";
import { useModal } from "./Media";
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

/** "reels love" — horizontal scroller of vertical videos with a quick-add bag icon. */
export function ReelsLove({ shorts }: { shorts: YouTubeVideo[] }) {
  const open = useModal();
  const bag = useBag();
  return (
    <div className="love-row" role="list">
      {shorts.map((v) => (
        <div key={v.id} className="love-card" role="listitem">
          <button
            type="button"
            className="love-play"
            onClick={() => open({ type: "youtube", id: v.id, title: v.title, vertical: true })}
            aria-label={`Play: ${v.title}`}
          >
            <img src={v.thumbnailUrl} alt="" loading="lazy" decoding="async" />
            <span className="love-play-icon" aria-hidden="true">
              <PlayIcon size={20} />
            </span>
            <span className="love-caption">{v.title.replace(/#\S+/g, "").trim()}</span>
          </button>
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
      ))}
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
