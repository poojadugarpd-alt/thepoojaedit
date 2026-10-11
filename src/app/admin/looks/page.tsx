import Link from "next/link";

import { ActionForm, Field } from "@/features/admin/action-form";
import { Pill } from "@/features/admin/format";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/server/auth/require-admin";
import { listLooksAdmin } from "@/server/looks";

import { createLookAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Looks" };

export default async function AdminLooksPage() {
  await requireAdmin();
  const looks = await listLooksAdmin(prisma);

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-strong">Looks</h1>
        <p className="mt-1 text-xs text-ink-soft">
          &ldquo;Shop this Reel&rdquo; pages at thepoojaedit.in/looks/&hellip; Each one
          shows your pieces from a Reel with Add to cart. New Looks start as drafts that
          only you can see.
        </p>
      </div>

      {looks.length > 0 ? (
        <ul className="divide-y divide-line rounded-[10px] border border-line">
          {looks.map((l) => (
            <li key={l.id}>
              <Link
                href={`/admin/looks/${l.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-strong">
                    {l.title}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    /looks/{l.slug} · {l._count.items}{" "}
                    {l._count.items === 1 ? "piece" : "pieces"}
                  </span>
                </span>
                <Pill value={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No Looks yet.</p>
      )}

      <section className="space-y-3 rounded-[10px] border border-line p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-strong">
          New Look
        </h2>
        <ActionForm action={createLookAction} submitLabel="Create draft">
          <Field
            label="Title"
            name="title"
            required
            maxLength={120}
            placeholder="e.g. Diwali linen edit"
            hint="Also sets the web address; you can change it after."
          />
        </ActionForm>
      </section>
    </div>
  );
}
