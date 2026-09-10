"use client";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";

/** The panel-shaped placeholder every table screen shows while it loads. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy role="status">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-11 rounded-xl" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}

export function QueryError({
  what,
  onRetry,
}: {
  what: string;
  onRetry: () => void;
}) {
  return (
    <ErrorState
      title={`Couldn't load ${what}`}
      description="The service did not answer. Nothing has been lost — trying again re-runs the request."
      onRetry={onRetry}
    />
  );
}
