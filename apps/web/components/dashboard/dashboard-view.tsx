"use client";

import { CalendarClock, Inbox } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter, periodLabel } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBanner } from "@/components/dashboard/verdict-banner";
import { useMe } from "@/lib/auth";
import {
  useDashboard,
  usePeriods,
  type PeriodSelection,
  type PeriodsResponse,
} from "@/lib/analytics";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShare,
} from "@/lib/format";

/**
 * The selected period lives in the URL: it is navigational state the browser
 * already owns, and a store holding it would duplicate the address bar for one
 * consumer. `safeReturnTo` allowlists pathnames only, so a session expiry returns
 * to the default period — documented in lib/session.ts.
 */
function useRequestedPeriod(fallbackYear: number | null): PeriodSelection | null {
  const params = useSearchParams();
  const rawYear = params.get("year");
  const rawMonth = params.get("month");

  const year = Number(rawYear);
  const month = Number(rawMonth);

  const resolvedYear =
    rawYear !== null && Number.isInteger(year) && year > 0 ? year : fallbackYear;

  if (resolvedYear === null) return null;

  return {
    year: resolvedYear,
    month:
      rawMonth !== null && Number.isInteger(month) && month >= 1 && month <= 12
        ? month
        : null,
  };
}

function isCovered(periods: PeriodsResponse, period: PeriodSelection): boolean {
  const year = periods.years.find((entry) => entry.year === period.year);
  if (!year) return false;
  if (period.month === null) return true;
  return year.months.some((month) => month.month === period.month);
}

export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();

  // Nothing private starts until the session has resolved to a user
  // (apps/web/README.md, 4.9).
  const { data: user } = useMe();
  const signedIn = Boolean(user);

  const periods = usePeriods(signedIn);
  const requested = useRequestedPeriod(periods.data?.defaultYear ?? null);

  const covered =
    periods.data && requested ? isCovered(periods.data, requested) : false;

  const dashboard = useDashboard(
    requested ?? { year: 0, month: null },
    signedIn && covered,
  );

  function selectPeriod(period: PeriodSelection) {
    const query = new URLSearchParams({ year: String(period.year) });
    if (period.month !== null) query.set("month", String(period.month));
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title="Dashboard"
      description="Hours, cost, revenue and margin across the agency."
      actions={actions}
    />
  );

  if (periods.isPending) {
    return (
      <>
        {header()}
        <DashboardSkeleton />
      </>
    );
  }

  if (periods.isError) {
    return (
      <>
        {header()}
        <ErrorState
          title="Couldn't load the reporting periods"
          description="The service did not answer. Nothing has been lost — trying again re-runs the request."
          onRetry={() => void periods.refetch()}
        />
      </>
    );
  }

  if (!periods.data.hasData || !requested) {
    return (
      <>
        {header()}
        <EmptyState
          icon={Inbox}
          title="No data has been ingested yet"
          description="Upload the timesheet, the salary overview and the project prices, and this page will show the month's hours, cost, revenue and margin."
        />
      </>
    );
  }

  const yearEntry = periods.data.years.find(
    (entry) => entry.year === requested.year,
  );

  const filter = (
    <PeriodFilter
      value={requested}
      years={periods.data.years.map((entry) => entry.year)}
      months={yearEntry?.months ?? []}
      onChange={selectPeriod}
    />
  );

  const selectedMonth = yearEntry?.months.find(
    (month) => month.month === requested.month,
  );

  return (
    <>
      {header(filter)}

      {periods.data.warnings.length > 0 ? (
        <Notice
          tone="warning"
          title={`${periods.data.warnings.length} ${periods.data.warnings.length === 1 ? "gap" : "gaps"} in the loaded data`}
        >
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {periods.data.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {!covered ? (
        <EmptyState
          icon={CalendarClock}
          title={`Nothing logged in ${periodLabel(requested)}`}
          description={`The loaded spreadsheets do not cover ${periodLabel(requested)}. Pick a period from the filter above, or upload the rows for this one.`}
        />
      ) : dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError ? (
        <ErrorState
          title="Couldn't load this period"
          description="The service did not answer for the period you picked. Trying again re-runs the request."
          onRetry={() => void dashboard.refetch()}
        />
      ) : (
        <DashboardFigures
          data={dashboard.data}
          monthIncomplete={
            selectedMonth ? !selectedMonth.hasSalaries : false
          }
        />
      )}
    </>
  );
}

function DashboardFigures({
  data,
  monthIncomplete,
}: {
  data: ReturnType<typeof useDashboard>["data"] & object;
  monthIncomplete: boolean;
}) {
  const { totals, completeness, reconciliation, period, currency } = data;
  const partial =
    completeness.cost === "partial" || completeness.revenue === "partial";

  return (
    <>
      <VerdictBanner
        periodLabel={period.label}
        // "this month" only reads correctly for a single month; a whole-year
        // view has to name the year or the sentence lies about its scope.
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
          hint={`earned by this period's hours · ${formatCurrency(totals.bookedRevenue)} sold`}
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

      {partial ? (
        <Notice
          tone="danger"
          title="These figures are a known subtotal, not the whole answer"
        >
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {completeness.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
            {completeness.issues.length === 0 ? (
              <li>
                An input behind {period.label} is missing, so profit and margin
                are withheld rather than reported.
              </li>
            ) : null}
          </ul>
        </Notice>
      ) : monthIncomplete ? (
        <Notice tone="warning" title="This period has no salary data">
          Hours are recorded for {period.label}, but no salaries, so no cost can
          be calculated for it.
        </Notice>
      ) : null}

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
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
