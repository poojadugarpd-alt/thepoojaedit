"use client";

/** Google-style search-result snippet, live off Title/metaTitle/slug/
 *  metaDescription as the admin edits them — the same fields `/admin/
 *  products/[id]` already saved as "SEO title"/"SEO description", just
 *  shown the way they'll actually appear rather than as two bare inputs. */
export function SeoPreview({
  url,
  title,
  metaTitle,
  description,
  metaDescription,
}: {
  url: string;
  title: string;
  metaTitle: string;
  description: string;
  metaDescription: string;
}) {
  const shownTitle = metaTitle.trim() || title.trim() || "Untitled product";
  const shownDescription =
    metaDescription.trim() || description.trim() || "No description yet.";
  return (
    <div className="rounded border border-line p-3">
      <p className="truncate text-[13px] text-[#1a0dab]">{shownTitle}</p>
      <p className="truncate text-xs text-[#006621]">{url}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-[#545454]">{shownDescription}</p>
    </div>
  );
}
