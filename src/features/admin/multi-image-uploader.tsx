"use client";

import { useRef, useState } from "react";

import { uploadWithProgress } from "@/app/admin/home/home-media-uploader";

import { compressImage } from "./compress-image";
import type { UploadResult, UploadTicket } from "./single-image-uploader";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Add several photos at once to a list (the /styling carousels). Each file
 * goes through the same shrink → signed upload → confirm flow as the single
 * uploader, one after another, so the list keeps the order they were picked.
 */
export function MultiImageUploader({
  requestUpload,
  confirmUpload,
  remaining,
  label = "Add photos",
  hint = "JPEG, PNG or WebP up to 8MB each. You can pick several at once.",
}: {
  requestUpload: (contentType: string) => Promise<UploadTicket>;
  confirmUpload: (input: {
    mediaId: string;
    contentType: string;
  }) => Promise<UploadResult>;
  /** How many more photos the list takes. */
  remaining: number;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(all: File[]) {
    const files = all.filter((f) => IMAGE_TYPES.includes(f.type)).slice(0, remaining);
    if (files.length === 0) {
      setError("Use JPEG, PNG or WebP photos.");
      return;
    }
    setBusy(true);
    setError(null);
    let added = 0;
    let failure: string | null = null;
    for (const [i, original] of files.entries()) {
      const prefix = files.length > 1 ? `Photo ${i + 1} of ${files.length}: ` : "";
      try {
        setProgress(`${prefix}preparing…`);
        // Same shrink-before-upload as product photos (D-158).
        const file = await compressImage(original);
        const ticket = await requestUpload(file.type);
        if (!ticket.ok) {
          failure = ticket.message;
          break;
        }
        await uploadWithProgress(ticket.signedUrl, file, (pct) =>
          setProgress(`${prefix}uploading ${pct}%`),
        );
        setProgress(`${prefix}saving…`);
        const saved = await confirmUpload({
          mediaId: ticket.mediaId,
          contentType: file.type,
        });
        if (!saved.ok) {
          failure = saved.message;
          break;
        }
        added++;
      } catch {
        failure = "Upload failed. Check your connection and try again.";
        break;
      }
    }
    if (!failure) {
      // Full reload, not router.refresh() (D-155).
      window.location.reload();
      return;
    }
    setError(
      added > 0
        ? `${failure} (${added} photo${added === 1 ? " was" : "s were"} added; reload the page to see them.)`
        : failure,
    );
    setBusy(false);
  }

  const full = remaining <= 0;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) void handleFiles(files);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || full}
        className="min-h-11 rounded border border-line px-4 text-sm font-medium text-ink-strong disabled:opacity-50"
      >
        {busy ? progress || "Working…" : full ? "Photo limit reached" : label}
      </button>
      {error && <p className="text-sm text-stop">{error}</p>}
      <p className="text-[11px] text-ink-soft">{hint}</p>
    </div>
  );
}
