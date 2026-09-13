"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  confirmHomeMediaUploadAction,
  requestHomeMediaUploadAction,
  revertHomeMediaToAutoAction,
  type HomeMediaSlotName,
} from "./actions";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

type Status = "idle" | "uploading" | "saving" | "error";

/** PUT the file to the signed URL with progress — same XHR approach as the
 * product ImageUploader (fetch has no upload-progress event). */
function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject());
    xhr.onerror = () => reject();
    xhr.send(file);
  });
}

/**
 * One home-page media slot: shows what's there now (an automatic product
 * photo, or a custom upload) and lets Pooja replace it with her own image or
 * short video, or go back to automatic. Deliberately a single file input for
 * both — the choice of image vs video is made by what she picks, not a
 * separate control (owner follow-up, 2026-09-13).
 */
export function HomeMediaUploader({
  slot,
  currentKind,
}: {
  slot: HomeMediaSlotName;
  currentKind: "auto" | "image" | "video";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const isVideo = VIDEO_TYPES.includes(file.type);
    const isImage = IMAGE_TYPES.includes(file.type);
    if (!isVideo && !isImage) {
      setError("Use a JPEG, PNG or WebP image, or an MP4/WebM video.");
      return;
    }
    const kind = isVideo ? "video" : "image";
    setStatus("uploading");
    setError(null);
    setProgress(0);
    try {
      const ticket = await requestHomeMediaUploadAction(slot, kind, file.type);
      if (!ticket.ok) {
        setStatus("error");
        setError(ticket.message);
        return;
      }
      await uploadWithProgress(ticket.signedUrl, file, setProgress);
      setStatus("saving");
      const confirmed = await confirmHomeMediaUploadAction(slot, {
        mediaId: ticket.mediaId,
        kind,
        contentType: file.type,
        alt: "",
      });
      if (!confirmed.ok) {
        setStatus("error");
        setError(confirmed.message);
        return;
      }
      setStatus("idle");
      router.refresh(); // pick up the newly saved media in the server-rendered preview
    } catch {
      setStatus("error");
      setError("Upload failed — check your connection and try again.");
    }
  }

  async function handleRevert() {
    setStatus("saving");
    setError(null);
    const result = await revertHomeMediaToAutoAction(slot);
    if (!result.ok) {
      setStatus("error");
      setError(result.message);
      return;
    }
    setStatus("idle");
    router.refresh();
  }

  const busy = status === "uploading" || status === "saving";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
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
              : currentKind === "auto"
                ? "Upload a photo or video"
                : "Replace"}
        </button>
        {currentKind !== "auto" && (
          <button
            type="button"
            onClick={handleRevert}
            disabled={busy}
            className="min-h-11 text-sm text-ink-soft underline disabled:opacity-50"
          >
            Use the automatic photo instead
          </button>
        )}
      </div>
      {error && <p className="text-sm text-stop">{error}</p>}
      <p className="text-[11px] text-ink-soft">
        JPEG/PNG/WebP up to 8MB, or MP4/WebM up to 15MB. Keep video short — it plays
        automatically for every visitor.
      </p>
    </div>
  );
}
