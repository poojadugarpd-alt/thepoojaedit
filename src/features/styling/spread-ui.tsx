import Image from "next/image";

import type { StylingPhoto, StylingTestimonial } from "@/server/styling";

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

/**
 * Reviews (owner, 2026-11-28): each review's photos in one row with the
 * whole review underneath; two reviews sit side by side on wide screens.
 */
export function ReviewBlock({
  reviews,
  heading,
}: {
  reviews: StylingTestimonial[];
  heading: string;
}) {
  return (
    <section className="u-section u-section--fill" aria-labelledby="testimonials">
      <div className="u-page">
        <h2 id="testimonials" className="u-h2">
          {heading}
        </h2>
        <div
          className={`mt-10 grid gap-x-10 gap-y-16 ${reviews.length > 1 ? "lg:grid-cols-2" : ""}`}
        >
          {reviews.map((t) => {
            const photos = t.photos.filter((p) => p.url);
            return (
              <figure key={t.id}>
                {photos.length > 0 && (
                  <div className="flex gap-2">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className={`u-media relative h-44 overflow-hidden sm:h-64 ${photos.length > 1 ? "flex-1" : "w-40 sm:w-52"}`}
                      >
                        <Image
                          src={p.url!}
                          alt={p.alt || `${t.name}, styled by Pooja`}
                          fill
                          sizes="(min-width: 1024px) 13vw, (min-width: 640px) 25vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {t.quote && (
                  <blockquote className="mt-6 max-w-[62ch] whitespace-pre-line text-lg leading-relaxed text-ink-strong">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                )}
                <figcaption className="mt-5">
                  <span className="u-label block">{t.name}</span>
                  {t.detail && (
                    <span className="mt-1 block text-sm text-ink-soft">{t.detail}</span>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
