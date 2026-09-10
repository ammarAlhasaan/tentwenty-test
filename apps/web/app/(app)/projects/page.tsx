import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsView } from "@/components/projects/projects-view";
import { TableSkeleton } from "@/components/query-states";

export const metadata: Metadata = { title: "Projects" };

// A server shell only: the figures are private and load in the client component
// behind AuthGate (apps/web/README.md, section 8).
export default function ProjectsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ProjectsView />
    </Suspense>
  );
}
