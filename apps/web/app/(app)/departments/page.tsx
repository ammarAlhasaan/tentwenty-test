import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentsView } from "@/components/departments/departments-view";
import { TableSkeleton } from "@/components/query-states";

export const metadata: Metadata = { title: "Departments" };

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <DepartmentsView />
    </Suspense>
  );
}
