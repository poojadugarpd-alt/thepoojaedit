import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thrift Store" };

// Placeholder. The real thrift catalogue (one-of-one pieces with condition,
// measurements, flaws and SOLD-state URLs) is built in Phase 4.
export default function ThriftPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Thrift Store</h1>
      <p className="mt-3 text-black/70 dark:text-white/70">
        Pre-loved pieces are being measured and listed. Check back soon.
      </p>
    </div>
  );
}
