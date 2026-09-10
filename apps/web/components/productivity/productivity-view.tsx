"use client";

import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PercentPill } from "@/components/pill";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError, TableSkeleton } from "@/components/query-states";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableFooterCell,
  TableHead,
  TableHeader,
  TableName,
  TablePanel,
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
        badge={scope.badge}
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

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((employee) => employee.department)
            .filter((name): name is string => Boolean(name)),
        ),
      ].sort(),
    [employees],
  );

  const rows = useMemo(
    () =>
      department === ALL
        ? employees
        : employees.filter((employee) => employee.department === department),
    [employees, department],
  );

  // The footer is the agency, whatever the filter above it: the API's own
  // company figure, over the API's own totals. Summing the filtered rows under
  // an "Agency" label would put one department's hours beside everyone's
  // productivity.
  const totals = useMemo(
    () =>
      employees.reduce(
        (running, employee) => ({
          hours: running.hours + (employee.totalHours ?? 0),
          billable: running.billable + (employee.billableHours ?? 0),
        }),
        { hours: 0, billable: 0 },
      ),
    [employees],
  );

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Gauge}
        title={`No hours logged in ${period.label}`}
        description="Nobody logged time in this period. Pick another period, or upload the rows for this one."
      />
    );
  }

  return (
    <>
      <TablePanel
        title={`${rows.length} ${rows.length === 1 ? "person" : "people"} · ${period.label}`}
        actions={
          <label className="flex items-center gap-2 text-[13px] font-semibold">
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
        }
      >
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
              <TableFooterCell align="start">Agency</TableFooterCell>
              <TableFooterCell />
              <TableFooterCell numeric>
                {formatNumber(totals.hours)}
              </TableFooterCell>
              <TableFooterCell numeric>
                {formatNumber(totals.billable)}
              </TableFooterCell>
              {/* The agency figure, whatever the filter. Recomputing it for a
                  filtered subset would be a second implementation of a rule
                  apps/api owns and already reports. */}
              <TableFooterCell numeric>
                {formatShare(companyProductivity)}
              </TableFooterCell>
            </TableRow>
          </TableFooter>
        </TableScroller>
      </TablePanel>

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
