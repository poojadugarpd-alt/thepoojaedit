"use client";

import Image from "next/image";
import { useState } from "react";

import type { PublicImage } from "@/server/catalog/public-shape";

export function Gallery({ images, title }: { images: PublicImage[]; title: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-black/5 text-sm text-black/40 dark:bg-white/10 dark:text-white/40">
        No image
      </div>
    );
  }
  const main = images[Math.min(active, images.length - 1)];
  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/10">
        <Image
          key={main.url}
          src={main.url}
          alt={main.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 520px"
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
                className={`relative h-20 w-16 shrink-0 overflow-hidden rounded border transition-colors ${
                  i === active
                    ? "border-foreground"
                    : "border-transparent hover:border-black/30 dark:hover:border-white/40"
                }`}
              >
                <Image src={im.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
