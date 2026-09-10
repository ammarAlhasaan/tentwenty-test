"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { CompletenessNotice } from "@/components/completeness-notice";
import { EmptyState } from "@/components/empty-state";
import { MissingValue } from "@/components/missing-value";
import { PageHeader } from "@/components/page-header";
import { Tag } from "@/components/pill";
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
import { useDepartments, type DepartmentsResponse } from "@/lib/analytics";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "cn";

export function DepartmentsView() {
  const scope = usePeriodScope();
  const departments = useDepartments(scope.period, scope.enabled);
  const focus = useSearchParams().get("focus");

  return (
    <>
      <PageHeader
        title="Departments"
        badge={scope.badge}
        description="Hours and cost per department, and the people inside each one."
        actions={scope.filter}
      />

      {scope.gate ??
        (departments.isPending ? (
          <TableSkeleton />
        ) : departments.isError ? (
          <QueryError
            what="the departments"
            onRetry={() => void departments.refetch()}
          />
        ) : (
          <DepartmentsTables data={departments.data} focus={focus} />
        ))}
    </>
  );
}

function DepartmentsTables({
  data,
  focus,
}: {
  data: DepartmentsResponse;
  focus: string | null;
}) {
  const { departments, period, completeness } = data;

  // The drill-down is local UI state, not API data: the response already nests
  // every department's people, so opening one costs no request.
  const [opened, setOpened] = useState<string | null>(null);

  if (departments.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title={`No department activity in ${period.label}`}
        description="Nobody logged hours in this period. Pick another period, or upload the rows for this one."
      />
    );
  }

  const selected =
    departments.find((entry) => entry.department === opened) ??
    departments.find((entry) => entry.department === focus) ??
    departments[0];

  const totals = departments.reduce(
    (running, entry) => ({
      hours: running.hours + (entry.totalHours ?? 0),
      billable: running.billable + (entry.billableHours ?? 0),
      cost: running.cost + (entry.cost ?? 0),
    }),
    { hours: 0, billable: 0, cost: 0 },
  );

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <TablePanel title={period.label}>
          <TableScroller minWidth={620}>
            <TableHeader>
              <TableRow>
                <TableHead align="start">Department</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((entry) => {
                const current = entry.department === selected?.department;

                return (
                  <TableRow
                    key={entry.department}
                    className={cn(current && "bg-brand-tint")}
                  >
                    <TableCell align="start">
                      <button
                        type="button"
                        aria-pressed={current}
                        onClick={() => setOpened(entry.department)}
                        className="rounded font-semibold outline-none hover:text-brand hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {entry.department}
                      </button>
                      {!entry.costComplete ? (
                        <span className="ml-2">
                          <Tag tone="warning">cost partial</Tag>
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell numeric>
                      {formatNumber(entry.totalHours)}
                    </TableCell>
                    <TableCell numeric>
                      {formatNumber(entry.billableHours)}
                    </TableCell>
                    <TableCell numeric>{formatCurrency(entry.cost)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableFooterCell align="start">Total</TableFooterCell>
                <TableFooterCell numeric>
                  {formatNumber(totals.hours)}
                </TableFooterCell>
                <TableFooterCell numeric>
                  {formatNumber(totals.billable)}
                </TableFooterCell>
                <TableFooterCell numeric>
                  {formatCurrency(totals.cost)}
                </TableFooterCell>
              </TableRow>
            </TableFooter>
          </TableScroller>
        </TablePanel>

        {selected ? (
          <TablePanel
            title={selected.department}
            subtitle="every person in this department"
          >
            <TableScroller minWidth={380}>
              <TableHeader>
                <TableRow>
                  <TableHead align="start">Employee</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.employees.map((employee) => (
                  <TableRow key={employee.employeeNo}>
                    <TableCell align="start" className="whitespace-normal">
                      <TableName
                        name={employee.name}
                        detail={employee.designation ?? undefined}
                      />
                    </TableCell>
                    <TableCell numeric>
                      {formatNumber(employee.totalHours)}
                    </TableCell>
                    <TableCell numeric>
                      {employee.cost == null ? (
                        <MissingValue />
                      ) : (
                        formatCurrency(employee.cost)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroller>
          </TablePanel>
        ) : null}
      </div>

      <CompletenessNotice
        completeness={completeness}
        periodLabel={period.label}
      />

      <p className="max-w-[90ch] text-[13px] text-ink-3 text-pretty">
        A department&apos;s cost is what its billable hours carry. Support staff
        log no billable time, so their salaries reach the departments that do —
        which is why a support department can read a genuine cost of zero.
      </p>
    </>
  );
}
