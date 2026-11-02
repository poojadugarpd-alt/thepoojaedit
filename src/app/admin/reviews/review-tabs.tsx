import Link from "next/link";

const TABS = [
  { href: "/admin/reviews", label: "Reviews", key: "reviews" },
  { href: "/admin/reviews/invites", label: "Invite links", key: "invites" },
] as const;

export function ReviewTabs({ current }: { current: "reviews" | "invites" }) {
  return (
    <nav aria-label="Reviews sections" className="flex gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`flex min-h-11 items-center rounded border px-3 text-sm font-medium ${
            t.key === current
              ? "border-foreground bg-foreground text-background"
              : "border-line text-ink-strong"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
