import { Loader2 } from "lucide-react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/70 dark:bg-neutral-800/70 ${className}`}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-neutral-400 ${className}`} />;
}

/** A page-level loading block: title + KPI row + list, used by route loading.tsx. */
export function PageSkeleton({
  kpis = 4,
  rows = 6,
}: {
  kpis?: number;
  rows?: number;
}) {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {kpis > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** A detail-page loading block: header + two-column cards. */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
