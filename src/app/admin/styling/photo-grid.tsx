import Image from "next/image";
import type { ReactNode } from "react";

import type { StylingPhoto } from "@/server/styling";

import { ListControls } from "./list-controls";
import {
  moveStylingPhotoAction,
  removeStylingPhotoAction,
  type PhotoTarget,
} from "./photo-actions";

/** The photos already in one /styling list, in page order, with controls. */
export function PhotoGrid({
  target,
  photos,
  extra,
}: {
  target: PhotoTarget;
  photos: StylingPhoto[];
  /** Anything to show under a photo's controls (the design caption form). */
  extra?: (photo: StylingPhoto) => ReactNode;
}) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {photos.map((p, i) => (
        <li key={p.id} className="space-y-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded border border-line bg-fill">
            {p.url && (
              <Image
                src={p.url}
                alt={p.alt || `Photo ${i + 1}`}
                fill
                sizes="200px"
                className="object-cover"
              />
            )}
            <span className="absolute left-1.5 top-1.5 rounded bg-ground/90 px-1.5 text-[11px] font-medium text-ink-strong">
              {i + 1}
            </span>
          </div>
          <ListControls
            moveEarlier={
              i > 0 ? moveStylingPhotoAction.bind(null, target, p.id, -1) : undefined
            }
            moveLater={
              i < photos.length - 1
                ? moveStylingPhotoAction.bind(null, target, p.id, 1)
                : undefined
            }
            remove={removeStylingPhotoAction.bind(null, target, p.id)}
          />
          {extra?.(p)}
        </li>
      ))}
    </ul>
  );
}
