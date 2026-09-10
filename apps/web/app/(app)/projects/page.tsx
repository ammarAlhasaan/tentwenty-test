import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="What each project was sold for, what it cost, and what was left."
      />
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Once the timesheet and project price spreadsheets are ingested, every project will appear here with its price, hours by department, cost and margin."
      />
    </>
  );
}
