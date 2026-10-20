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

/* ───────────────────────── Hover-to-play previews ───────────────────────── */

export type PreviewSource = { kind: "mp4"; src: string } | { kind: "youtube"; id: string };

const canHover = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Hover (or keyboard focus) state for a card. A short delay avoids spinning up
 * players while the mouse just sweeps across the grid.
 */
export function useHoverPlay() {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = () => {
    if (reducedMotion()) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(true), 140);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setActive(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    active,
    handlers: {
      onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && start(),
      onPointerLeave: stop,
      onFocus: start,
      onBlur: stop,
    },
  };
}

/** Muted preview layered over the poster. Mounted only while active, so it stops and frees memory on leave. */
export function VideoPreview({ source, active }: { source?: PreviewSource; active: boolean }) {
  const [ready, setReady] = useState(false);
  const [touch, setTouch] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => setTouch(!canHover()), []);
  useEffect(() => {
    if (!active) setReady(false);
  }, [active]);

  // Touch screens can't hover: self-hosted clips play while on screen instead.
  useEffect(() => {
    const v = ref.current;
    if (!touch || source?.kind !== "mp4" || !v || reducedMotion()) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = source.src;
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [touch, source]);

  if (!source) return null;
  if (touch) {
    return source.kind === "mp4" ? (
      <video
        ref={ref}
        className="media-fill preview is-ready"
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
      />
    ) : null;
  }
  if (!active) return null;
  const cls = `media-fill preview ${ready ? "is-ready" : ""}`;
  return source.kind === "mp4" ? (
    <video
      className={cls}
      src={source.src}
      autoPlay
      muted
      loop
      playsInline
      onPlaying={() => setReady(true)}
      aria-hidden="true"
    />
  ) : (
    <iframe
      className={cls}
      src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${source.id}&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3&fs=0`}
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      aria-hidden="true"
      title=""
      // The embed shows its own spinner/title for ~1s; keep the poster up until it's playing.
      onLoad={() => setTimeout(() => setReady(true), 700)}
    />
  );
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
  const { active, handlers } = useHoverPlay();
  const isCarousel = item.kind === "carousel";
  const badge = isCarousel ? item.carouselLabel ?? "Carousel" : CATEGORY_LABEL[item.category];
  const title = item.caption.split("\n")[0].slice(0, 80) || "Instagram post";

  const visual = (
    <span className={`media ${isCarousel ? "r-4x5" : "r-9x16"}`}>
      {item.thumbnailUrl ? (
        <img className="media-fill" src={item.thumbnailUrl} alt={`${badge}${item.brand ? ` for ${item.brand}` : ""}: ${title}`} loading="lazy" decoding="async" />
      ) : (
        <PlaceholderCover seed={index} label={item.sample ? "Sample" : undefined} title={item.brand} />
      )}
      <VideoPreview source={item.videoUrl ? { kind: "mp4", src: item.videoUrl } : undefined} active={active} />
      <span className="badge badge-on-media">{badge}</span>
      {isCarousel && item.slideCount ? (
        <span className="slides" aria-label={`${item.slideCount} slides`}>
          <LayersIcon /> {item.slideCount}
        </span>
      ) : null}
      <span className={`play ${active && item.videoUrl ? "is-hidden" : ""}`} aria-hidden="true">
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

  // Canva designs open on Canva; sample entries have no real post, so send people to the profile.
  if (item.externalUrl || item.sample) {
    return (
      <a
        className="card"
        href={item.externalUrl ?? item.permalink}
        target="_blank"
        rel="noopener"
        aria-label={`${badge}: ${title} (opens ${item.externalUrl ? "Canva" : "Instagram"})`}
      >
        {visual}
        {body}
      </a>
    );
  }
  return (
    <div className="card" {...handlers}>
      {visual}
      {body}
      <button
        type="button"
        className="card-hit"
        onClick={() => open({ type: "instagram", permalink: item.permalink, title })}
        aria-label={`Play ${badge}: ${title}`}
      />
    </div>
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
  const { active, handlers } = useHoverPlay();
  const dur = formatDuration(video.durationSec);
  return (
    <div className="card" {...handlers}>
      <span className={`media ${video.isShort ? "r-9x16" : "r-16x9"}`}>
        <img className="media-fill" src={video.thumbnailUrl} alt={`YouTube ${video.isShort ? "Short" : "video"} thumbnail: ${video.title}`} loading="lazy" decoding="async" />
        <VideoPreview source={{ kind: "youtube", id: video.id }} active={active} />
        {dur && <span className="duration">{dur}</span>}
        {video.isShort && <span className="badge badge-on-media">Short</span>}
        <span className={`play ${active ? "is-hidden" : ""}`} aria-hidden="true">
          <PlayIcon size={22} />
        </span>
      </span>
      <span className="card-body">
        <span className={video.isShort ? "card-caption" : "card-title"}>{video.title}</span>
      </span>
      <button
        type="button"
        className="card-hit"
        onClick={() => open({ type: "youtube", id: video.id, title: video.title, vertical: video.isShort })}
        aria-label={`Play: ${video.title}`}
      />
    </div>
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
  if (item.href) {
    return (
      <a className="card" href={item.href} target="_blank" rel="noopener" aria-label={`${item.category}: ${item.title} (opens Canva)`}>
        {inner}
      </a>
    );
  }
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
