"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PercentPill } from "@/components/pill";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useProductivity, type ProductivityResponse } from "@/lib/analytics";
import { formatNumber, formatShare } from "@/lib/format";

const ALL = "All";

export function ProductivityView() {
  const scope = usePeriodScope();
  const productivity = useProductivity(scope.period, scope.enabled);

  return (
    <>
      <PageHeader
        title="Productivity"
        description="Billable hours as a share of everything logged, per person."
        actions={scope.filter}
      />

      {scope.gate ??
        (productivity.isPending ? (
          <TableSkeleton />
        ) : productivity.isError ? (
          <QueryError
            what="the productivity figures"
            onRetry={() => void productivity.refetch()}
          />
        ) : (
          <ProductivityTable data={productivity.data} />
        ))}
    </>
  );
}

function ProductivityTable({ data }: { data: ProductivityResponse }) {
  const { employees, period, companyProductivity } = data;

  // A view filter over data already in hand — local UI state, no request.
  const [department, setDepartment] = useState(ALL);

  const departments = [
    ...new Set(
      employees
        .map((employee) => employee.department)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort();

  const rows =
    department === ALL
      ? employees
      : employees.filter((employee) => employee.department === department);

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Gauge}
        title={`No hours logged in ${period.label}`}
        description="Nobody logged time in this period. Pick another period, or upload the rows for this one."
      />
    );
  }

  const totals = rows.reduce(
    (running, employee) => ({
      hours: running.hours + (employee.totalHours ?? 0),
      billable: running.billable + (employee.billableHours ?? 0),
    }),
    { hours: 0, billable: 0 },
  );

  return (
    <>
      <Card className="py-0">
        <CardHeader className="flex-row flex-wrap items-center gap-3 px-5 pt-5">
          <CardTitle>
            {rows.length} {rows.length === 1 ? "person" : "people"} ·{" "}
            {period.label}
          </CardTitle>
          <label className="ml-auto flex items-center gap-2 text-[13px] font-semibold">
            <span className="text-ink-2">Department</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-[11px] border border-border bg-card px-3 py-2 text-[13.5px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value={ALL}>All</option>
              {departments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </CardHeader>

        <TableScroller minWidth={680}>
          <TableHeader>
            <TableRow>
              <TableHead align="start">Employee</TableHead>
              <TableHead align="start">Department</TableHead>
              <TableHead>Total hours</TableHead>
              <TableHead>Billable</TableHead>
              <TableHead>Productivity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((employee) => (
              <TableRow key={employee.employeeNo}>
                <TableCell align="start" className="whitespace-normal">
                  <TableName
                    name={employee.name}
                    detail={employee.employeeNo}
                  />
                </TableCell>
                <TableCell align="start" className="text-ink-2">
                  {employee.department ?? "—"}
                </TableCell>
                <TableCell numeric>
                  {formatNumber(employee.totalHours)}
                </TableCell>
                <TableCell numeric>
                  {formatNumber(employee.billableHours)}
                </TableCell>
                <TableCell>
                  {/* Below half their logged time billable reads as a flag, not
                      a failure — the API reports it either way. */}
                  <PercentPill
                    value={employee.productivity}
                    kind="share"
                    warnBelow={0.5}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableFooterCell align="start">
                {department === ALL ? "Agency" : department}
              </TableFooterCell>
              <TableFooterCell />
              <TableFooterCell numeric>
                {formatNumber(totals.hours)}
              </TableFooterCell>
              <TableFooterCell numeric>
                {formatNumber(totals.billable)}
              </TableFooterCell>
              <TableFooterCell numeric>
                {department === ALL
                  ? formatShare(companyProductivity)
                  : formatShare(
                      totals.hours > 0 ? totals.billable / totals.hours : null,
                    )}
              </TableFooterCell>
            </TableRow>
          </TableFooter>
        </TableScroller>
      </Card>

      <p className="max-w-[90ch] text-[13px] text-ink-3 text-pretty">
        Productivity is billable hours divided by total hours logged. Which
        categories count as billable is set on the Assumptions screen. Somebody
        with hours logged and none billable reads a genuine 0%; somebody with no
        hours at all in the period reads an em dash, because the figure is
        undefined rather than zero.
      </p>
    </>
  );
}
