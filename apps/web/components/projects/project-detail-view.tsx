"use client";

import Link from "next/link";
import { CompletenessNotice } from "@/components/completeness-notice";
import { MissingValue } from "@/components/missing-value";
import { Notice } from "@/components/notice";
import { PercentPill } from "@/components/pill";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { VerdictBanner } from "@/components/dashboard/verdict-banner";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableName,
  TablePanel,
  TableRow,
  TableScroller,
} from "@/components/ui/table";
import { useMe } from "@/lib/auth";
import { useProject, type ProjectDetailResponse } from "@/lib/analytics";
import { isApiError } from "@/lib/api";
import { formatCurrency, formatNumber, formatShare } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { FolderKanban } from "lucide-react";

export function ProjectDetailView({ refCode }: { refCode: string }) {
  const { data: user } = useMe();
  const project = useProject(refCode, Boolean(user));

  if (project.isPending) return <TableSkeleton />;

  if (project.isError) {
    // 404 is an answer, not a failure: the ref code has neither hours nor a
    // price row anywhere in the loaded data.
    if (isApiError(project.error) && project.error.status === 404) {
      return (
        <EmptyState
          icon={FolderKanban}
          title="No such project"
          description={`Nothing in the loaded spreadsheets carries the ref code ${refCode} — neither hours nor a price row.`}
          action={
            <Link
              href="/projects"
              className="rounded text-sm font-semibold text-brand outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Back to projects
            </Link>
          }
        />
      );
    }
    return (
      <QueryError what="this project" onRetry={() => void project.refetch()} />
    );
  }

  return <ProjectDetail data={project.data} />;
}

function ProjectDetail({ data }: { data: ProjectDetailResponse }) {
  const { totals, departments, employees, completeness } = data;

  return (
    <>
      <VerdictBanner
        periodLabel={`${data.refCode}${data.client ? ` · ${data.client}` : ""}`}
        subject={data.name.length > 60 ? data.refCode : data.name}
        periodPhrase="overall"
        profit={totals.profit}
        margin={totals.profitability}
        revenue={data.price}
        cost={totals.cost}
        profitNote="price minus cost"
        marginNote="profit as a share of the price"
      />

      {!data.priced ? (
        <Notice tone="warning" title="This project has no price row">
          {formatCurrency(totals.cost)} of cost is booked against{" "}
          {data.refCode}, but the project prices file has no row for it — so
          profit, margin and every revenue share are unknown rather than zero.
        </Notice>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        <StatCard
          label="Price"
          value={formatCurrency(data.price)}
          hint={
            data.salesMonth
              ? `sold in ${data.salesMonth.label}`
              : "whole project"
          }
        />
        <StatCard
          label="Hours"
          value={formatNumber(totals.hours)}
          hint={`${employees.length} ${employees.length === 1 ? "person" : "people"} across ${departments.length} ${departments.length === 1 ? "department" : "departments"}`}
        />
        <StatCard
          label="Cost"
          value={formatCurrency(totals.cost)}
          hint="every month the project ran"
        />
      </div>

      <CompletenessNotice
        completeness={completeness}
        periodLabel={data.refCode}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <TablePanel title="Hours and cost by department">
          <TableScroller minWidth={340}>
            <TableHeader>
              <TableRow>
                <TableHead align="start">Department</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.department}>
                  <TableCell align="start">
                    <Link
                      href={`/departments?focus=${encodeURIComponent(department.department)}`}
                      className="rounded font-semibold outline-none hover:text-brand hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {department.department}
                    </Link>
                  </TableCell>
                  <TableCell numeric>
                    {formatNumber(department.hours)}
                  </TableCell>
                  <TableCell numeric>
                    {formatShare(department.shareOfHours)}
                  </TableCell>
                  <TableCell numeric>
                    {formatCurrency(department.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableScroller>
        </TablePanel>

        <TablePanel title="Employee contribution">
          <TableScroller minWidth={560}>
            <TableHeader>
              <TableRow>
                <TableHead align="start">Employee</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Revenue share</TableHead>
                <TableHead>Profitability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.employeeNo}>
                  <TableCell align="start" className="whitespace-normal">
                    <TableName
                      name={employee.name}
                      detail={employee.designation ?? employee.department ?? undefined}
                    />
                  </TableCell>
                  <TableCell numeric>{formatNumber(employee.hours)}</TableCell>
                  <TableCell numeric>
                    {employee.cost == null ? (
                      <MissingValue />
                    ) : (
                      formatCurrency(employee.cost)
                    )}
                  </TableCell>
                  <TableCell numeric>
                    {formatCurrency(employee.revenueShare)}
                  </TableCell>
                  <TableCell>
                    <PercentPill value={employee.profitability} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableScroller>
        </TablePanel>
      </div>

    </>
  );
}
