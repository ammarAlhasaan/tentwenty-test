import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="text-sm text-muted-foreground">
          What each project was sold for, what it cost, and what was left.
        </p>
      </div>

      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Once the timesheet and project price spreadsheets are ingested, every project will appear here with its price, hours by department, cost and margin."
      />
    </div>
  );
}
