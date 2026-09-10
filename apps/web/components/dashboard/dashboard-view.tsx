"use client";

import { CompletenessNotice } from "@/components/completeness-notice";
import { PageHeader } from "@/components/page-header";
import { usePeriodScope } from "@/components/period-scope";
import { QueryError } from "@/components/query-states";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBanner } from "@/components/dashboard/verdict-banner";
import { useDashboard, type DashboardResponse } from "@/lib/analytics";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShare,
} from "@/lib/format";

export function DashboardView() {
  const scope = usePeriodScope();
  const dashboard = useDashboard(scope.period, scope.enabled);

  return (
    <>
      <PageHeader
        title="Dashboard"
        badge={scope.badge}
        description="Hours, cost, revenue and margin across the agency."
        actions={scope.filter}
      />

      {scope.gate ?? (
        dashboard.isPending ? (
          <DashboardSkeleton />
        ) : dashboard.isError ? (
          <QueryError
            what="this period"
            onRetry={() => void dashboard.refetch()}
          />
        ) : (
          <DashboardFigures data={dashboard.data} />
        )
      )}
    </>
  );
}

function DashboardFigures({ data }: { data: DashboardResponse }) {
  const { totals, completeness, reconciliation, period, currency } = data;

  return (
    <>
      <VerdictBanner
        periodLabel={period.label}
        // "this month" is false for a twelve-month view, so the sentence has to
        // follow the scope the figures actually describe.
        periodPhrase={period.month === null ? `in ${period.label}` : "this month"}
        profit={totals.profit}
        margin={totals.margin}
        revenue={totals.allocatedRevenue}
        cost={totals.cost}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        <StatCard
          label="Total hours"
          value={formatNumber(totals.totalHours)}
          hint={`${formatNumber(totals.nonBillableHours)} of them not billable`}
        />
        <StatCard
          label="Billable hours"
          value={formatNumber(totals.billableHours)}
          share={totals.productivity}
          hint={`${formatShare(totals.productivity)} of logged time`}
        />
        <StatCard
          label="Cost"
          value={formatCurrency(totals.cost)}
          hint={
            reconciliation.overhead > 0
              ? `salaries and ${formatCurrency(reconciliation.overhead)} overhead`
              : "salaries, unbillable time and overhead"
          }
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(totals.allocatedRevenue)}
          hint="each project's price, split by the hours worked in this period"
        />
        <StatCard
          label="Margin"
          value={formatPercent(totals.margin)}
          tone={
            totals.margin == null
              ? "neutral"
              : totals.margin >= 0
                ? "positive"
                : "negative"
          }
          hint={`profit ${formatCurrency(totals.profit)}`}
        />
      </div>

      {/* Scoped to the period on screen. The standing warnings from /periods
          describe the default year and belong with the data that produced
          them, on the uploads screen. */}
      <CompletenessNotice
        completeness={completeness}
        periodLabel={period.label}
      />

      <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
        <span>
          <span className="font-mono text-ink-2">—</span> missing from the source
          data
        </span>
        <span>
          <span className="font-mono text-ink-2">0</span> a genuine zero
        </span>
        <span>All money in {currency}</span>
      </p>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">Loading the figures</span>
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Rendered while the client picks up the URL's period. `useSearchParams` makes
 * this subtree client-rendered, so the page keeps its shape until it arrives.
 */
export function DashboardViewFallback() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">Loading the dashboard</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
