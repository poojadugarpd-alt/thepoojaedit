/**
 * Shared `loading.tsx` building blocks (admin speed audit, 2026-09-13).
 *
 * Every admin route is `force-dynamic` (real data, never stale), so a tap
 * always waits on a fresh Tokyo round trip. Without a `loading.tsx`, Next
 * shows nothing at all until that finishes — a tap that visibly does
 * nothing reads as broken, not just slow. These give an instant response
 * shaped like the real screen, which is also what lets `<Link>`'s default
 * viewport prefetch do anything useful for a dynamic route (it can prefetch
 * the static shell — this skeleton — even though the data itself can only
 * be fetched on navigation).
 *
 * Plain CSS (`animate-pulse` + the existing `--fill` token), no new
 * dependency, and shaped closely enough to the real layout that nothing
 * visibly reflows when the real content swaps in.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-fill ${className}`} />;
}

export function TitleBarSkeleton() {
  return (
    <div className="flex items-center justify-between gap-2">
      <Bar className="h-6 w-32" />
      <Bar className="h-11 w-20" />
    </div>
  );
}

function CardRowSkeleton() {
  return (
    <div className="flex gap-3 rounded border border-line p-3">
      <Bar className="h-14 w-[45px] shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-3 w-1/2" />
        <Bar className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="hidden space-y-2 sm:block">
      {Array.from({ length: rows }).map((_, i) => (
        <Bar key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/** Orders / Products / Inventory / Customers / Returns / Notifications / Activity lists. */
export function AdminListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <TitleBarSkeleton />
      <Bar className="h-11 w-full sm:max-w-xs" />
      <div className="space-y-2 sm:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <CardRowSkeleton key={i} />
        ))}
      </div>
      <TableRowsSkeleton rows={rows} />
    </div>
  );
}

/** Order detail / Return detail / Product edit / Customer detail. */
export function AdminDetailSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-6 w-2/3" />
        <Bar className="h-4 w-1/3" />
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="space-y-2 rounded border border-line p-3">
          <Bar className="h-3 w-24" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

/** New-product / settings-style forms. */
export function AdminFormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-md space-y-4">
      <Bar className="h-6 w-40" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1">
          <Bar className="h-3 w-20" />
          <Bar className="h-11 w-full" />
        </div>
      ))}
      <Bar className="h-11 w-32" />
    </div>
  );
}

/** Overview / Analytics dashboards. */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Bar className="h-6 w-32" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
