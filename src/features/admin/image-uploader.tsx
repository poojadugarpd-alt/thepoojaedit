"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  confirmImageUploadAction,
  requestImageUploadAction,
} from "@/app/admin/products/actions";

// iOS Safari transcodes HEIC camera photos to one of these automatically when
// the file input's `accept` is restricted to them — this is standard iOS
// behaviour, not something we implement. If a HEIC file still arrives (e.g.
// AirDropped in from Files rather than picked from Photos), we reject it with
// a plain explanation rather than silently failing or attempting a browser
// HEIC decode, which no engine supports today.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

type Status = "queued" | "uploading" | "saving" | "done" | "error";

interface QueueItem {
  localId: string;
  file: File;
  previewUrl: string;
  altText: string;
  isFlaw: boolean;
  status: Status;
  progress: number;
  error?: string;
  width: number | null;
  height: number | null;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** PUT the file to the signed URL with progress, via XHR (fetch has no upload-progress event). */
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
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed — check the connection and retry."));
    xhr.send(file);
  });
}

export function ImageUploader({
  productId,
  isThrift,
  defaultAltPrefix,
  hasExistingImages,
}: {
  productId: string;
  isThrift: boolean;
  defaultAltPrefix: string;
  hasExistingImages: boolean;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const nextLabelNumber = useRef(1);
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const items: QueueItem[] = [];
    for (const file of Array.from(files)) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        items.push({
          localId,
          file,
          previewUrl: "",
          altText: "",
          isFlaw: false,
          status: "error",
          progress: 0,
          width: null,
          height: null,
          error:
            file.type.includes("heic") || file.type.includes("heif") || file.type === ""
              ? "HEIC photo — pick it from Photos (not Files/AirDrop) so it converts to JPEG automatically, or share it as JPEG."
              : `Unsupported file type (${file.type || "unknown"}). Use JPEG, PNG or WebP.`,
        });
        continue;
      }
      const dims = await readImageDimensions(file);
      items.push({
        localId,
        file,
        previewUrl: URL.createObjectURL(file),
        altText: `${defaultAltPrefix} — photo ${nextLabelNumber.current++}`,
        isFlaw: false,
        status: "queued",
        progress: 0,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });
    }
    setQueue((q) => [...q, ...items]);
  }

  function updateItem(localId: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  }

  function removeItem(localId: string) {
    setQueue((q) => {
      const it = q.find((x) => x.localId === localId);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return q.filter((x) => x.localId !== localId);
    });
  }

  async function uploadOne(item: QueueItem) {
    updateItem(item.localId, { status: "uploading", progress: 0, error: undefined });
    const ticket = await requestImageUploadAction(productId, item.file.type);
    if (!ticket.ok) {
      updateItem(item.localId, { status: "error", error: ticket.message });
      return;
    }
    try {
      await uploadWithProgress(ticket.signedUrl, item.file, (pct) =>
        updateItem(item.localId, { progress: pct }),
      );
    } catch (e) {
      updateItem(item.localId, {
        status: "error",
        error: e instanceof Error ? e.message : "Upload failed.",
      });
      return;
    }
    updateItem(item.localId, { status: "saving" });
    const confirmed = await confirmImageUploadAction(productId, {
      imageId: ticket.imageId,
      path: ticket.path,
      contentType: item.file.type,
      altText: item.altText.trim() || defaultAltPrefix,
      type: item.isFlaw ? "FLAW" : "GALLERY",
      isPrimary: !hasExistingImages,
      width: item.width,
      height: item.height,
    });
    if (!confirmed.ok) {
      updateItem(item.localId, { status: "error", error: confirmed.message });
      return;
    }
    updateItem(item.localId, { status: "done", progress: 100 });
  }

  async function uploadAll() {
    const pending = queue.filter((i) => i.status === "queued" || i.status === "error");
    for (const item of pending) {
      await uploadOne(item);
    }
    router.refresh();
    // Clear anything that finished; leave failures visible for retry.
    setQueue((q) => q.filter((i) => i.status !== "done"));
  }

  const hasPending = queue.some((i) => i.status === "queued" || i.status === "error");
  const isBusy = queue.some((i) => i.status === "uploading" || i.status === "saving");

  return (
    <div className="space-y-3 rounded border border-dashed border-line p-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          className="min-h-11 rounded border border-line px-3 text-sm"
        >
          Add photos
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="min-h-11 rounded border border-line px-3 text-sm"
        >
          Take photo
        </button>
        {hasPending && (
          <button
            type="button"
            onClick={uploadAll}
            disabled={isBusy}
            className="min-h-11 rounded bg-foreground px-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {isBusy ? "Uploading…" : `Upload ${queue.filter((i) => i.status !== "done").length}`}
          </button>
        )}
        <input
          ref={pickerRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT_ATTR}
          capture="environment"
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="space-y-2">
          {queue.map((it) => (
            <li key={it.localId} className="flex items-start gap-3 rounded border border-line p-2">
              {it.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a served asset
                <img
                  src={it.previewUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-stop-bg text-stop">
                  ⚠
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {it.status === "error" ? (
                  <p className="text-xs text-stop">{it.error}</p>
                ) : (
                  <>
                    <input
                      value={it.altText}
                      onChange={(e) => updateItem(it.localId, { altText: e.target.value })}
                      placeholder="alt text"
                      disabled={it.status !== "queued"}
                      className="min-h-11 w-full rounded border border-line bg-transparent px-2 py-1 text-base sm:text-sm"
                    />
                    {isThrift && (
                      <label className="flex items-center gap-1 text-xs text-ink-soft">
                        <input
                          type="checkbox"
                          checked={it.isFlaw}
                          disabled={it.status !== "queued"}
                          onChange={(e) => updateItem(it.localId, { isFlaw: e.target.checked })}
                        />
                        Flaw photo
                      </label>
                    )}
                    {(it.status === "uploading" || it.status === "saving") && (
                      <div className="h-1.5 w-full overflow-hidden rounded bg-line">
                        <div
                          className="h-full bg-foreground transition-all"
                          style={{ width: `${it.status === "saving" ? 100 : it.progress}%` }}
                        />
                      </div>
                    )}
                    {it.status === "done" && <p className="text-xs text-ok">Uploaded.</p>}
                  </>
                )}
                {it.status === "error" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => uploadOne(it)}
                      className="min-h-11 text-xs underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
              {(it.status === "queued" || it.status === "error") && (
                <button
                  type="button"
                  onClick={() => removeItem(it.localId)}
                  aria-label="Remove"
                  className="flex min-h-11 shrink-0 items-center px-1 text-ink-soft"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-ink-soft">
        JPEG, PNG or WebP · up to 8MB · at least 400px on each side. The first photo
        uploaded for a product becomes its primary image automatically.
      </p>
    </div>
  );
}
