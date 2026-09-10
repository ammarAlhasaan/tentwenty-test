"use client";

import { CalendarClock } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter, periodLabel } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBanner } from "@/components/dashboard/verdict-banner";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShare,
} from "@/lib/format";
import {
  SAMPLE_DASHBOARD,
  SAMPLE_PERIOD,
  SAMPLE_YEARS,
} from "@/lib/sample-dashboard";

/**
 * The selected period lives in the URL: it is navigational state the browser
 * already owns, and a store holding it would duplicate the address bar for one
 * consumer. Note that `safeReturnTo` allowlists pathnames only, so a session
 * expiry returns to `/` without the period — documented in lib/session.ts.
 */
function useSelectedPeriod() {
  const params = useSearchParams();
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  return {
    year: Number.isInteger(year) && year > 0 ? year : SAMPLE_PERIOD.year,
    month:
      Number.isInteger(month) && month >= 1 && month <= 12
        ? month
        : SAMPLE_PERIOD.month,
  };
}

export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const selected = useSelectedPeriod();

  const years = SAMPLE_YEARS.includes(
    selected.year as (typeof SAMPLE_YEARS)[number],
  )
    ? SAMPLE_YEARS
    : ([selected.year, ...SAMPLE_YEARS] as const);

  function selectPeriod(period: { year: number; month: number }) {
    router.replace(
      `${pathname}?year=${period.year}&month=${period.month}`,
      { scroll: false },
    );
  }

  const covered =
    selected.year === SAMPLE_PERIOD.year &&
    selected.month === SAMPLE_PERIOD.month;

  const { totals, completeness, warnings, overhead, peopleWhoLoggedTime } =
    SAMPLE_DASHBOARD;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Hours, cost, revenue and margin across the agency."
        actions={
          <PeriodFilter
            year={selected.year}
            month={selected.month}
            years={years}
            onChange={selectPeriod}
          />
        }
      />

      <Notice tone="warning" title="Sample data — this is not a live figure">
        The reporting endpoints are not available on this build, so nothing here
        has been read from an ingested spreadsheet. Every figure below is a fixed
        example used to show the layout.
      </Notice>

      {!covered ? (
        <EmptyState
          icon={CalendarClock}
          title={`Nothing logged in ${periodLabel(selected.year, selected.month)}`}
          description={`The example covers ${SAMPLE_DASHBOARD.period.label} only. Once the timesheet, salary and price spreadsheets are ingested, every month they cover will be selectable here.`}
          action={
            <Button variant="outline" onClick={() => selectPeriod(SAMPLE_PERIOD)}>
              Go to {SAMPLE_DASHBOARD.period.label}
            </Button>
          }
        />
      ) : (
        <>
          <VerdictBanner
            periodLabel={SAMPLE_DASHBOARD.period.label}
            profit={totals.profit}
            margin={totals.margin}
            revenue={totals.allocatedRevenue}
            cost={totals.cost}
          />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(14.25rem,1fr))] gap-4">
            <StatCard
              label="Total hours"
              value={formatNumber(totals.totalHours)}
              hint={`${peopleWhoLoggedTime} people logged time`}
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
              hint={`salaries and ${formatCurrency(overhead)} overhead`}
            />
            <StatCard
              label="Revenue"
              value={formatCurrency(totals.allocatedRevenue)}
              hint={`earned by this month's hours · ${formatCurrency(totals.bookedRevenue)} sold`}
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

          {completeness.cost === "partial" ||
          completeness.revenue === "partial" ? (
            <Notice
              tone="danger"
              title="Some figures above are a known subtotal, not the whole answer"
            >
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {completeness.issues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {warnings.length > 0 ? (
            <Notice
              tone="warning"
              title={`${warnings.length} gaps elsewhere in the data`}
            >
              <p className="mb-1">
                These do not change the figures above — {SAMPLE_DASHBOARD.period.label} ties.
                They are places the dataset is incomplete.
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning.code}>{warning.message}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
            <span>
              <span className="font-mono text-ink-2">—</span> missing from the
              source data
            </span>
            <span>
              <span className="font-mono text-ink-2">0</span> a genuine zero
            </span>
            <span>All money in {SAMPLE_DASHBOARD.currency}</span>
          </p>
        </>
      )}
    </>
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
