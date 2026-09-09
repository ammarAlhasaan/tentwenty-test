import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          Where the time actually goes, billable and internal.
        </p>
      </div>

      <EmptyState
        icon={Tags}
        title="No categories yet"
        description="Once the timesheet spreadsheet is ingested, this page will show hours per category, so internal time can be read against billable work."
      />
    </div>
  );
}
