"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GraphicItem, InstagramItem, YouTubeVideo } from "@/lib/types";
import { CloseIcon, InstagramIcon, LayersIcon, PlayIcon } from "./icons";

/* ───────────────────────── Modal (native <dialog>) ───────────────────────── */

type ModalContent =
  | { type: "instagram"; permalink: string; title: string }
  | { type: "youtube"; id: string; title: string; vertical: boolean }
  | { type: "image"; src: string; alt: string; title: string };

const ModalCtx = createContext<(c: ModalContent) => void>(() => {});
export const useModal = () => useContext(ModalCtx);

function igEmbed(permalink: string) {
  return `${permalink.split("?")[0].replace(/\/$/, "")}/embed/captioned/`;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState<ModalContent | null>(null);

  const open = useCallback((c: ModalContent) => {
    setContent(c);
    requestAnimationFrame(() => ref.current?.showModal());
  }, []);
  const close = () => ref.current?.close();

  return (
    <ModalCtx.Provider value={open}>
      {children}
      <dialog
        ref={ref}
        className="modal"
        aria-label={content?.title}
        onClose={() => setContent(null)}
        onClick={(e) => e.target === ref.current && close()}
      >
        {content && (
          <div className={`modal-body modal-${content.type} ${content.type === "youtube" && content.vertical ? "is-vertical" : ""}`}>
            <button className="modal-close" onClick={close} aria-label="Close">
              <CloseIcon />
            </button>
            {content.type === "instagram" && (
              <iframe src={igEmbed(content.permalink)} title={content.title} allow="encrypted-media; fullscreen" loading="lazy" />
            )}
            {content.type === "youtube" && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${content.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={content.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
            {content.type === "image" && <img src={content.src} alt={content.alt} />}
          </div>
        )}
      </dialog>
    </ModalCtx.Provider>
  );
}

/* ───────────────────────── Autoplay preview ───────────────────────── */

/** Muted looping preview that only plays while on screen (saves data + battery). */
function AutoplayVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = src;
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} className="media-fill" poster={poster} muted loop playsInline preload="none" aria-hidden="true" />;
}

/* ───────────────────────── Placeholder cover ───────────────────────── */

const HUES = [
  ["#3a1f14", "#d38a4f"],
  ["#1d1a2e", "#b07acb"],
  ["#13251f", "#7fbf9b"],
  ["#2b1520", "#e07a8a"],
  ["#1a2230", "#7aa5d9"],
  ["#2a2414", "#e3b26b"],
];

export function PlaceholderCover({ seed, label, title }: { seed: number; label?: string; title?: string }) {
  const [a, b] = HUES[seed % HUES.length];
  return (
    <span className="ph" style={{ "--ph-a": a, "--ph-b": b } as React.CSSProperties} aria-hidden="true">
      {label && <span className="ph-label">{label}</span>}
      {title && <span className="ph-title">{title}</span>}
    </span>
  );
}

/* ───────────────────────── Cards ───────────────────────── */

const CATEGORY_LABEL: Record<InstagramItem["category"], string> = {
  brand: "Brand Reel",
  affiliate: "Affiliate",
  ugc: "UGC",
  carousel: "Carousel",
};

export function InstagramCard({ item, index }: { item: InstagramItem; index: number }) {
  const open = useModal();
  const isCarousel = item.kind === "carousel";
  const badge = isCarousel ? item.carouselLabel ?? "Carousel" : CATEGORY_LABEL[item.category];
  const title = item.caption.split("\n")[0].slice(0, 80) || "Instagram post";

  const visual = (
    <span className={`media ${isCarousel ? "r-4x5" : "r-9x16"}`}>
      {item.videoUrl ? (
        <AutoplayVideo src={item.videoUrl} poster={item.thumbnailUrl} />
      ) : item.thumbnailUrl ? (
        <img className="media-fill" src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <PlaceholderCover seed={index} label={item.sample ? "Sample" : undefined} title={item.brand} />
      )}
      <span className="badge badge-on-media">{badge}</span>
      {isCarousel && item.slideCount ? (
        <span className="slides" aria-label={`${item.slideCount} slides`}>
          <LayersIcon /> {item.slideCount}
        </span>
      ) : null}
      <span className="play" aria-hidden="true">
        {isCarousel ? <LayersIcon size={22} /> : <PlayIcon size={22} />}
      </span>
    </span>
  );

  const body = (
    <span className="card-body">
      {item.brand && !item.sample && <span className="card-brand">{item.brand}</span>}
      <span className="card-caption">{item.caption}</span>
    </span>
  );

  // Sample entries have no real post to embed; send people to the profile instead.
  if (item.sample) {
    return (
      <a className="card" href={item.permalink} target="_blank" rel="noopener" aria-label={`${badge}: ${title} (opens Instagram)`}>
        {visual}
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="card"
      onClick={() => open({ type: "instagram", permalink: item.permalink, title })}
      aria-label={`Play ${badge}: ${title}`}
    >
      {visual}
      {body}
    </button>
  );
}

export function formatDuration(sec?: number) {
  if (sec == null) return undefined;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function YouTubeCard({ video }: { video: YouTubeVideo }) {
  const open = useModal();
  const dur = formatDuration(video.durationSec);
  return (
    <button
      type="button"
      className="card"
      onClick={() => open({ type: "youtube", id: video.id, title: video.title, vertical: video.isShort })}
      aria-label={`Play: ${video.title}`}
    >
      <span className={`media ${video.isShort ? "r-9x16" : "r-16x9"} kenburns`}>
        <img className="media-fill" src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" />
        {dur && <span className="duration">{dur}</span>}
        {video.isShort && <span className="badge badge-on-media">Short</span>}
        <span className="play" aria-hidden="true">
          <PlayIcon size={22} />
        </span>
      </span>
      <span className="card-body">
        <span className={video.isShort ? "card-caption" : "card-title"}>{video.title}</span>
      </span>
    </button>
  );
}

export function GraphicCard({ item, index }: { item: GraphicItem; index: number }) {
  const open = useModal();
  const ratio = { aspectRatio: item.ratio ?? "4/5" };
  const inner = (
    <span className="media zoom" style={ratio}>
      {item.image ? (
        <img className="media-fill" src={item.image} alt={item.alt} loading="lazy" decoding="async" />
      ) : (
        <PlaceholderCover seed={index + 2} label={item.sample ? "Sample" : undefined} title={item.title} />
      )}
      <span className="badge badge-on-media">{item.category}</span>
    </span>
  );
  if (!item.image) return <div className="card card-static">{inner}</div>;
  return (
    <button
      type="button"
      className="card"
      onClick={() => open({ type: "image", src: item.image!, alt: item.alt, title: item.title })}
      aria-label={`View ${item.category}: ${item.title}`}
    >
      {inner}
    </button>
  );
}

export function EmptyState({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {href && (
        <a className="btn btn-ghost btn-sm" href={href} target="_blank" rel="noopener">
          <InstagramIcon size={16} /> See it on Instagram
        </a>
      )}
    </div>
  );
}
