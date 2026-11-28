import Image from "next/image";

import type { StylingPhoto } from "@/server/styling";

import type { ReviewMoment } from "./spread";

/** A strip of gallery photos between sections. */
export function PhotoBand({ photos }: { photos: StylingPhoto[] }) {
  const cols =
    photos.length >= 4
      ? "sm:grid-cols-4"
      : photos.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";
  return (
    <section aria-label="Photos" className="u-page py-6 sm:py-10">
      <div className={`grid grid-cols-2 gap-2 sm:gap-3 ${cols}`}>
        {photos.map((p) => (
          <div key={p.id} className="u-media relative aspect-[4/5] overflow-hidden">
            <Image
              src={p.url!}
              alt={p.alt || "Pooja Dugar in Indian wear"}
              fill
              sizes="(min-width: 640px) 25vw, 50vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** One review spot: a few of the client's own words beside one of her photos. */
export function ReviewBand({
  moment: m,
  heading,
  flip,
}: {
  moment: ReviewMoment;
  heading?: string;
  flip: boolean;
}) {
  return (
    <section
      aria-label={heading ? undefined : `Review from ${m.name}`}
      aria-labelledby={heading ? "testimonials" : undefined}
      className="u-section u-rule"
    >
      <figure
        className={`u-page grid items-center gap-8 sm:gap-12 ${m.photo ? (flip ? "sm:grid-cols-[1fr_minmax(0,20rem)]" : "sm:grid-cols-[minmax(0,20rem)_1fr]") : ""}`}
      >
        {m.photo?.url && (
          <div
            className={`u-media relative aspect-[4/5] w-full max-w-[20rem] overflow-hidden ${flip ? "sm:order-2" : ""}`}
          >
            <Image
              src={m.photo.url}
              alt={m.photo.alt || `${m.name}, styled by Pooja`}
              fill
              sizes="(min-width: 640px) 20rem, 100vw"
              className="object-cover"
            />
          </div>
        )}
        <div>
          {heading && (
            <h2 id="testimonials" className="u-eyebrow">
              {heading}
            </h2>
          )}
          <blockquote
            className={`max-w-[34ch] text-2xl leading-snug text-ink-strong sm:text-3xl ${heading ? "mt-6" : ""}`}
          >
            &ldquo;{m.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-6">
            <span className="u-label block">{m.name}</span>
            {m.detail && (
              <span className="mt-1 block text-sm text-ink-soft">{m.detail}</span>
            )}
          </figcaption>
        </div>
      </figure>
    </section>
  );
}
