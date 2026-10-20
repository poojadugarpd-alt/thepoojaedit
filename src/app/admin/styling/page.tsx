import Link from "next/link";

import type { StylingEnquiryStatus } from "@/generated/prisma";
import { Pill, ts } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  ENQUIRY_STATUSES,
  getStylingContent,
  listStylingEnquiries,
} from "@/server/styling";

import { StylingTabs } from "./styling-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Styling" };

type Filter = StylingEnquiryStatus | "OPEN" | "ALL";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "OPEN", label: "Open" },
  ...ENQUIRY_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
  { value: "ALL", label: "All" },
];

export default async function AdminStylingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === status)
    ? (status as Filter)
    : "OPEN";
  const [enquiries, content] = await Promise.all([
    listStylingEnquiries(prisma, { status: filter }),
    getStylingContent(prisma),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-strong">Styling enquiries</h1>
        <Link
          href="/admin/styling/edit"
          className="flex min-h-11 items-center rounded border border-line px-3 text-sm font-medium text-ink-strong"
        >
          Edit page
        </Link>
      </div>
      <StylingTabs current="enquiries" />
      {!content.published && (
        <p className="rounded-[10px] border border-line bg-fill px-4 py-3 text-sm text-ink">
          The Styling page is a draft, so shoppers can&rsquo;t send enquiries yet.{" "}
          <Link href="/admin/styling/edit" className="underline">
            Finish and publish it
          </Link>
          .
        </p>
      )}

      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={
              f.value === "OPEN" ? "/admin/styling" : `/admin/styling?status=${f.value}`
            }
            aria-current={f.value === filter ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
              f.value === filter
                ? "border-ink-strong text-ink-strong"
                : "border-line text-ink-soft"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {enquiries.length > 0 ? (
        <ul className="divide-y divide-line rounded-[10px] border border-line">
          {enquiries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/styling/${e.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-strong">
                    {e.name}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {e.service} · {e.location} · {ts(e.createdAt)}
                  </span>
                </span>
                <Pill value={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No enquiries here.</p>
      )}
    </div>
  );
}
