import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Productivity" };

export default function ProductivityPage() {
  return (
    <>
      <PageHeader
        title="Productivity"
        description="Billable hours as a share of everything logged, per person."
      />
      <EmptyState
        icon={Gauge}
        title="No hours logged yet"
        description="Once the timesheet spreadsheet is ingested, this page will show each employee's billable share of their logged hours."
      />
    </>
  );
}
