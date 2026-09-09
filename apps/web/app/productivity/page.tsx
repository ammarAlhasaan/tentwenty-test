import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Productivity" };

export default function ProductivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Productivity
        </h1>
        <p className="text-sm text-muted-foreground">
          Billable hours as a share of everything logged, per person.
        </p>
      </div>

      <EmptyState
        icon={Gauge}
        title="No hours logged yet"
        description="Once the timesheet spreadsheet is ingested, this page will show each employee's billable share of their logged hours."
      />
    </div>
  );
}
