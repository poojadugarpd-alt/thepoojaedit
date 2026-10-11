"use client";

import { useRef, useState } from "react";

import { uploadWithProgress } from "@/app/admin/home/home-media-uploader";
import { compressImage } from "@/features/admin/compress-image";

import {
  confirmPortraitUploadAction,
  removePortraitAction,
  requestPortraitUploadAction,
} from "../actions";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Status = "idle" | "uploading" | "saving" | "error";

/** Upload / replace / remove the portrait on /styling. */
export function PortraitUploader({ hasPortrait }: { hasPortrait: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(original: File) {
    if (!IMAGE_TYPES.includes(original.type)) {
      setError("Use a JPEG, PNG or WebP photo.");
      return;
    }
    setStatus("uploading");
    setError(null);
    setProgress(0);
    try {
      // Same shrink-before-upload as product photos (D-158).
      const file = await compressImage(original);
      const ticket = await requestPortraitUploadAction(file.type);
      if (!ticket.ok) {
        setStatus("error");
        setError(ticket.message);
        return;
      }
      await uploadWithProgress(ticket.signedUrl, file, setProgress);
      setStatus("saving");
      const saved = await confirmPortraitUploadAction({
        mediaId: ticket.mediaId,
        contentType: file.type,
      });
      if (!saved.ok) {
        setStatus("error");
        setError(saved.message);
        return;
      }
      // Full reload, not router.refresh() (D-155).
      window.location.reload();
    } catch {
      setStatus("error");
      setError("Upload failed. Check your connection and try again.");
    }
  }

  async function handleRemove() {
    setStatus("saving");
    setError(null);
    const result = await removePortraitAction();
    if (!result.ok) {
      setStatus("error");
      setError(result.message);
      return;
    }
    window.location.reload();
  }

  const busy = status === "uploading" || status === "saving";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="min-h-11 rounded border border-line px-4 text-sm font-medium text-ink-strong disabled:opacity-50"
        >
          {status === "uploading"
            ? `Uploading… ${progress}%`
            : status === "saving"
              ? "Saving…"
              : hasPortrait
                ? "Replace photo"
                : "Upload a photo"}
        </button>
        {hasPortrait && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="min-h-11 text-sm text-ink-soft underline disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
      </div>
      {error && <p className="text-sm text-stop">{error}</p>}
      <p className="text-[11px] text-ink-soft">
        JPEG, PNG or WebP up to 8MB. A tall photo (portrait shape) looks best.
      </p>
    </div>
  );
}
