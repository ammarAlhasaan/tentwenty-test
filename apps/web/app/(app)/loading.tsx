import { Skeleton } from "@/components/ui/skeleton";

// Route-group fallback: it covers every screen under (app), so it stays
// shape-neutral. A screen that wants its own shape supplies one through its
// page's Suspense boundary.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
