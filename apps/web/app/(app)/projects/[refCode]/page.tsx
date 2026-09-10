import { Suspense } from "react";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/query-states";

// The ref code is in the URL, so the title can be set without touching private
// data. Everything else loads in the client component behind AuthGate.
export async function generateMetadata({ params }: PageProps<"/projects/[refCode]">) {
  const { refCode } = await params;
  return { title: refCode };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[refCode]">) {
  const { refCode } = await params;

  return (
    <>
      <PageHeader
        title={refCode}
        description="Price, hours, cost and margin across every month this project ran."
      />
      <Suspense fallback={<TableSkeleton />}>
        <ProjectDetailView refCode={refCode} />
      </Suspense>
    </>
  );
}
