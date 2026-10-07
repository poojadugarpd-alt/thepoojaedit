/**
 * Shrink a product photo in the browser before it is uploaded (D-135).
 *
 * Phone photos arrive at ~4000px / 3–6 MB; the storefront never renders
 * wider than ~2000px (next/image generates the smaller sizes from this), and
 * the Supabase Free plan has a 1 GB storage cap — at the old ~1.3 MB average
 * that is only a few hundred more photos. Long edge capped at 2400px, JPEG
 * q=0.85 (Safari's canvas can't encode WebP, so JPEG is the portable choice).
 *
 * Never makes things worse: if decoding fails or the result isn't smaller,
 * the original file is returned untouched. PNGs are left alone (they may rely
 * on transparency, and product photos are almost never PNG).
 */
const MAX_EDGE = 2400;
const QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  if (file.type !== "image/jpeg" && file.type !== "image/webp") return file;
  // <img> applies EXIF orientation when decoding, so the canvas copy is upright.
  const img = await loadImage(file);
  if (!img || !img.naturalWidth || !img.naturalHeight) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob || blob.type !== "image/jpeg" || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
