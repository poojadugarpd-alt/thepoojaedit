"use client";

import Image from "next/image";
import { useState } from "react";

import type { PublicImage } from "@/server/catalog/public-shape";

export function Gallery({ images, title }: { images: PublicImage[]; title: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="u-media flex aspect-[3/4] w-full items-center justify-center text-sm text-ink-soft">
        No image
      </div>
    );
  }
  const main = images[Math.min(active, images.length - 1)];
  return (
    <div>
      <div className="u-media relative aspect-[3/4] w-full">
        <Image
          key={main.url}
          src={main.url}
          alt={main.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 560px"
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((im, i) => (
            <li key={im.url}>
              <button
                type="button"
                aria-label={`View image ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => setActive(i)}
                className={`relative h-24 w-20 shrink-0 overflow-hidden rounded-[10px] border transition-opacity ${
                  i === active
                    ? "border-ink-strong"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={im.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
