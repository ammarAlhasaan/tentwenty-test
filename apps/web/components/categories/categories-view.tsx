"use client";

import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ShareBar, Tag } from "@/components/pill";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableFooterCell,
  TableHead,
  TableHeader,
  TablePanel,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { useCategories, type CategoriesResponse } from "@/lib/analytics";
import { formatNumber, formatShare } from "@/lib/format";

export function CategoriesView() {
  const scope = usePeriodScope();
  const categories = useCategories(scope.period, scope.enabled);

  return (
    <>
      <PageHeader
        title="Categories"
        badge={scope.badge}
        description="Where the time actually goes, billable and internal."
        actions={scope.filter}
      />

      {scope.gate ??
        (categories.isPending ? (
          <TableSkeleton />
        ) : categories.isError ? (
          <QueryError
            what="the categories"
            onRetry={() => void categories.refetch()}
          />
        ) : (
          <CategoriesTable data={categories.data} />
        ))}
    </>
  );
}

function CategoriesTable({ data }: { data: CategoriesResponse }) {
  const { categories, period } = data;

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title={`No categories in ${period.label}`}
        description="No hours were logged against any category in this period. Pick another period, or upload the rows for this one."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        <StatCard
          label="Total hours"
          value={formatNumber(data.totalHours)}
          hint={`${categories.length} categories in ${period.label}`}
        />
        <StatCard
          label="Billable"
          value={formatNumber(data.billableHours)}
          share={
            data.totalHours && data.billableHours != null
              ? data.billableHours / data.totalHours
              : null
          }
          hint="charged to a project"
        />
        <StatCard
          label="Internal"
          value={formatNumber(data.internalHours)}
          hint="the agency absorbs it"
        />
      </div>

      <TablePanel title={`Hours per category · ${period.label}`}>
        <TableScroller minWidth={720}>
          <TableHeader>
            <TableRow>
              <TableHead align="start">Category</TableHead>
              <TableHead align="start">Counts as</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Share</TableHead>
              <TableHead align="start" className="w-56">
                <span className="sr-only">Share of logged time</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.category}>
                <TableCell align="start" className="font-semibold">
                  {category.category}
                </TableCell>
                <TableCell align="start">
                  <Tag tone={category.billable ? "brand" : "neutral"}>
                    {category.billable ? "Billable" : "Internal"}
                  </Tag>
                </TableCell>
                <TableCell numeric>{formatNumber(category.hours)}</TableCell>
                <TableCell numeric>
                  {formatShare(category.shareOfTotal)}
                </TableCell>
                <TableCell align="start">
                  <ShareBar
                    value={category.shareOfTotal}
                    tone={category.billable ? "brand" : "muted"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableFooterCell align="start">Total</TableFooterCell>
              <TableFooterCell />
              <TableFooterCell numeric>
                {formatNumber(data.totalHours)}
              </TableFooterCell>
              <TableFooterCell numeric>100.0%</TableFooterCell>
              <TableFooterCell />
            </TableRow>
          </TableFooter>
        </TableScroller>
      </TablePanel>

      <p className="max-w-[90ch] text-[13px] text-ink-3 text-pretty">
        This page answers where the time goes. Cost is read on the Dashboard and
        the project pages, where the indirect pool is loaded onto billable hours.
      </p>
    </>
  );
}
