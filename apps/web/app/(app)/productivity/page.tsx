import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductivityView } from "@/components/productivity/productivity-view";
import { TableSkeleton } from "@/components/query-states";

export const metadata: Metadata = { title: "Productivity" };

export default function ProductivityPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ProductivityView />
    </Suspense>
  );
}
