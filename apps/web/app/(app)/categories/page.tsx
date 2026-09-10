import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        description="Where the time actually goes, billable and internal."
      />
      <EmptyState
        icon={Tags}
        title="No categories yet"
        description="Once the timesheet spreadsheet is ingested, this page will show hours per category, so internal time can be read against billable work."
      />
    </>
  );
}
