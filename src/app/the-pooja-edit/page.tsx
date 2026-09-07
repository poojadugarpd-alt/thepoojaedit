import type { Metadata } from "next";

export const metadata: Metadata = { title: "The Pooja Edit" };

// Placeholder. The real catalogue listing (products from the database, filters,
// pagination, PDPs) is built in Phase 4.
export default function ThePoojaEditPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">The Pooja Edit</h1>
      <p className="mt-3 text-black/70 dark:text-white/70">
        New apparel is being photographed and catalogued. Check back soon.
      </p>
    </div>
  );
}
