"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { CompletenessNotice } from "@/components/completeness-notice";
import { EmptyState } from "@/components/empty-state";
import { MissingValue } from "@/components/missing-value";
import { PageHeader } from "@/components/page-header";
import { PercentPill, Tag } from "@/components/pill";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { Card } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableFooterCell,
  TableHead,
  TableHeader,
  TableName,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { useProjects, type ProjectsResponse } from "@/lib/analytics";
import { formatCurrency, formatNumber } from "@/lib/format";

export function ProjectsView() {
  const scope = usePeriodScope();
  const projects = useProjects(scope.period, scope.enabled);

  return (
    <>
      <PageHeader
        title="Projects"
        description="What each project was sold for, what it cost, and what was left."
        actions={scope.filter}
      />

      {scope.gate ??
        (projects.isPending ? (
          <TableSkeleton />
        ) : projects.isError ? (
          <QueryError
            what="the projects"
            onRetry={() => void projects.refetch()}
          />
        ) : (
          <ProjectsTable data={projects.data} />
        ))}
    </>
  );
}

function ProjectsTable({ data }: { data: ProjectsResponse }) {
  const { projects, period, completeness } = data;

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title={`No project activity in ${period.label}`}
        description="No ref code carried hours or a price in this period. Pick another period, or upload the rows for this one."
      />
    );
  }

  // Only the additive columns are totalled. Profit and margin are not: the API
  // withholds them per project when an input is missing, and summing what is
  // left would present a partial figure as a whole one.
  const totals = projects.reduce(
    (running, project) => ({
      hours: running.hours + (project.periodHours ?? 0),
      cost: running.cost + (project.periodCost ?? 0),
      revenue: running.revenue + (project.periodAllocatedRevenue ?? 0),
    }),
    { hours: 0, cost: 0, revenue: 0 },
  );

  return (
    <>
      <p className="text-sm text-ink-2">
        {projects.length} {projects.length === 1 ? "project" : "projects"} ·
        hours, cost and revenue are {period.label}; the price is the whole
        project.
      </p>

      <Card className="py-0">
        <TableScroller minWidth={880}>
          <TableHeader>
            <TableRow>
              <TableHead align="start">Project</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Revenue earned</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.refCode} className="hover:bg-brand-tint">
                <TableCell align="start" className="whitespace-normal">
                  <TableName name={project.name} detail={project.refCode}>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/projects/${encodeURIComponent(project.refCode)}`}
                        className="rounded text-[12.5px] font-semibold text-brand outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        View project
                      </Link>
                      {!project.priced ? (
                        <Tag tone="warning">no price on file</Tag>
                      ) : null}
                      {!project.costComplete ? (
                        <Tag tone="warning">cost partial</Tag>
                      ) : null}
                    </span>
                  </TableName>
                </TableCell>
                <TableCell numeric>
                  {project.price == null ? (
                    <MissingValue />
                  ) : (
                    formatCurrency(project.price)
                  )}
                </TableCell>
                <TableCell numeric>
                  {formatNumber(project.periodHours)}
                </TableCell>
                <TableCell numeric>
                  {formatCurrency(project.periodCost)}
                </TableCell>
                <TableCell numeric>
                  {formatCurrency(project.periodAllocatedRevenue)}
                </TableCell>
                <TableCell
                  numeric
                  className={
                    project.periodProfit != null && project.periodProfit < 0
                      ? "font-semibold text-negative"
                      : undefined
                  }
                >
                  {formatCurrency(project.periodProfit)}
                </TableCell>
                <TableCell>
                  <PercentPill value={project.periodMargin} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableFooterCell align="start">Total</TableFooterCell>
              <TableFooterCell />
              <TableFooterCell numeric>
                {formatNumber(totals.hours)}
              </TableFooterCell>
              <TableFooterCell numeric>
                {formatCurrency(totals.cost)}
              </TableFooterCell>
              <TableFooterCell numeric>
                {formatCurrency(totals.revenue)}
              </TableFooterCell>
              <TableFooterCell />
              <TableFooterCell />
            </TableRow>
          </TableFooter>
        </TableScroller>
      </Card>

      <CompletenessNotice
        completeness={completeness}
        periodLabel={period.label}
      />
    </>
  );
}
