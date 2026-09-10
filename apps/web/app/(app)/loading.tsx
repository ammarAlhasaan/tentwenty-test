import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">Loading</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-52 rounded-2xl" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
