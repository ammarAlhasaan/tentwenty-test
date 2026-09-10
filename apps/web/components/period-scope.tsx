"use client";

import { CalendarClock, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PeriodFilter, periodLabel } from "@/components/period-filter";
import { QueryError, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { isApiError } from "@/lib/api";
import { useLoadSampleData } from "@/lib/imports";
import { usePeriods, type PeriodSelection, type PeriodsResponse } from "@/lib/analytics";

function coveredMonths(
  periods: PeriodsResponse,
  year: number,
): PeriodsResponse["years"][number]["months"] {
  return periods.years.find((entry) => entry.year === year)?.months ?? [];
}

function isCovered(periods: PeriodsResponse, period: PeriodSelection): boolean {
  const months = coveredMonths(periods, period.year);
  if (months.length === 0) return false;
  if (period.month === null) return true;
  return months.some((month) => month.month === period.month);
}

/**
 * The period-scoped screens all need the same four things: the loaded periods,
 * the period the URL asks for, a filter bound to both, and the same handful of
 * states before any figure can be shown. Five screens needed it identically,
 * which is what earned it a component rather than a copy in each page.
 *
 * The period lives in the URL because it is navigational state the browser
 * already owns. `safeReturnTo` allowlists pathnames, so an expiry returns to a
 * screen's default period — see lib/session.ts.
 */
export function usePeriodScope() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Nothing private starts until the session resolves to a user (README 4.9).
  const { data: user } = useMe();
  const signedIn = Boolean(user);
  const periods = usePeriods(signedIn);

  const rawYear = params.get("year");
  const rawMonth = params.get("month");
  const parsedYear = Number(rawYear);
  const parsedMonth = Number(rawMonth);

  const year =
    rawYear !== null && Number.isInteger(parsedYear) && parsedYear > 0
      ? parsedYear
      : (periods.data?.defaultYear ?? null);

  const period: PeriodSelection | null =
    year === null
      ? null
      : {
          year,
          month:
            rawMonth !== null &&
            Number.isInteger(parsedMonth) &&
            parsedMonth >= 1 &&
            parsedMonth <= 12
              ? parsedMonth
              : null,
        };

  function go(next: PeriodSelection) {
    const query = new URLSearchParams({ year: String(next.year) });
    if (next.month !== null) query.set("month", String(next.month));
    router.replace(`${pathname}?${query}`, { scroll: false });
  }

  function selectPeriod(next: PeriodSelection) {
    // Changing the year can strip the selected month: not every year holds every
    // month. Keeping a month the new year does not have would leave the filter
    // showing one thing and the figures another, so it falls back to the whole
    // year — the one selection every covered year supports.
    if (
      next.month !== null &&
      periods.data &&
      !coveredMonths(periods.data, next.year).some(
        (month) => month.month === next.month,
      )
    ) {
      go({ year: next.year, month: null });
      return;
    }
    go(next);
  }

  const covered = Boolean(
    periods.data && period && isCovered(periods.data, period),
  );

  const filter =
    periods.data && period && periods.data.hasData ? (
      <PeriodFilter
        value={period}
        years={periods.data.years.map((entry) => entry.year)}
        months={coveredMonths(periods.data, period.year)}
        onChange={selectPeriod}
      />
    ) : null;

  /**
   * `null` means the caller may render figures. Anything else is the screen for
   * this state and should be rendered instead.
   */
  let gate: React.ReactNode = null;

  if (periods.isPending) {
    gate = <TableSkeleton />;
  } else if (periods.isError) {
    gate = (
      <QueryError
        what="the reporting periods"
        onRetry={() => void periods.refetch()}
      />
    );
  } else if (!periods.data.hasData || !period) {
    gate = <NoDataYet />;
  } else if (!covered) {
    gate = (
      <EmptyState
        icon={CalendarClock}
        title={`Nothing logged in ${periodLabel(period)}`}
        description={`The loaded spreadsheets do not cover ${periodLabel(period)}. Pick a period from the filter above, or upload the rows for this one.`}
        action={
          periods.data.defaultYear !== null ? (
            <Button
              variant="outline"
              onClick={() =>
                go({ year: periods.data.defaultYear!, month: null })
              }
            >
              Go to {periods.data.defaultYear}
            </Button>
          ) : null
        }
      />
    );
  }

  return {
    /** Safe to use for a query only when `gate` is null. */
    period: period ?? { year: 0, month: null },
    enabled: signedIn && covered,
    /** The period as a label for the page title, beside the filter control. */
    badge: period ? periodLabel(period) : undefined,
    filter,
    gate,
  };
}

/**
 * The first-run screen. It offers the sample import in place rather than only
 * pointing at the screen that holds the button: this is the first thing anyone
 * does with the product, and it reuses the same session-stamped mutation the
 * Uploads screen uses, so every reporting screen refills without a reload.
 *
 * It reaches all five period-scoped screens through the shared gate, which is
 * right — any of them can be someone's first screen.
 */
function NoDataYet() {
  const loadSample = useLoadSampleData();

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={Inbox}
        title="No data has been ingested yet"
        description="Load the supplied sample workbooks to see every screen filled in, or upload the timesheet, the salary overview and the project prices yourself."
        action={
          <>
            <Button
              disabled={loadSample.isPending}
              onClick={() => loadSample.mutate()}
            >
              {loadSample.isPending
                ? "Loading…"
                : "Load the sample workbooks"}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/uploads">Go to uploads</Link>}
            />
          </>
        }
      />

      {loadSample.isError ? (
        <Notice tone="danger" title="Couldn't load the sample workbooks">
          {isApiError(loadSample.error)
            ? loadSample.error.messages.join(" ")
            : "Something went wrong. Nothing was changed."}
        </Notice>
      ) : null}
    </div>
  );
}
