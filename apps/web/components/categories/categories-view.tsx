"use client";

import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ShareBar, Tag } from "@/components/pill";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableFooterCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { useCategories, type CategoriesResponse } from "@/lib/analytics";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";

export function CategoriesView() {
  const scope = usePeriodScope();
  const categories = useCategories(scope.period, scope.enabled);

  return (
    <>
      <PageHeader
        title="Categories"
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
  const { categories, period, currency } = data;

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
          hint={formatCurrency(data.billableDirectCost)}
        />
        <StatCard
          label="Internal"
          value={formatNumber(data.internalHours)}
          hint={`${formatCurrency(data.internalDirectCost)} the agency absorbs`}
        />
      </div>

      <Card className="py-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Hours per category · {period.label}</CardTitle>
        </CardHeader>
        <TableScroller minWidth={720}>
          <TableHeader>
            <TableRow>
              <TableHead align="start">Category</TableHead>
              <TableHead align="start">Counts as</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Share</TableHead>
              <TableHead>Direct cost</TableHead>
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
                <TableCell numeric>
                  {formatCurrency(category.directCost)}
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
              <TableFooterCell numeric>
                {formatCurrency(data.totalDirectCost)}
              </TableFooterCell>
              <TableFooterCell />
            </TableRow>
          </TableFooter>
        </TableScroller>
      </Card>

      <p className="max-w-[90ch] text-[13px] text-ink-3 text-pretty">
        Direct cost here is each category&apos;s hours valued at people&apos;s
        salary rates only — the one cost measure that adds up across every row,
        which is why this column totals to the whole salary bill in {currency}.
        The Dashboard is where fully-loaded cost is read, because loading the
        indirect pool onto billable hours and then adding internal time would
        count that pool twice.
      </p>
    </>
  );
}
