"use client";

import type { PeriodMonth, PeriodSelection } from "@/lib/analytics";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function monthLabel(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}

export function periodLabel(period: PeriodSelection): string {
  return period.month === null
    ? String(period.year)
    : `${monthLabel(period.month)} ${period.year}`;
}

const ALL_MONTHS = "all";

const selectClass =
  "rounded-[9px] bg-transparent px-2 py-1.5 text-[13.5px] font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * Native selects: the control the platform already gives a keyboard and a phone,
 * and what the design uses. The options come from `GET /periods`, so only a
 * period the API actually holds data for can be chosen — the honest empty state
 * is then reserved for a period reached by URL.
 */
export function PeriodFilter({
  value,
  years,
  months,
  onChange,
}: {
  value: PeriodSelection;
  years: number[];
  months: PeriodMonth[];
  onChange: (period: PeriodSelection) => void;
}) {
  const uncovered =
    value.month !== null && !months.some((month) => month.month === value.month)
      ? value.month
      : null;

  return (
    <div className="flex items-center gap-0.5 rounded-[13px] border border-border bg-card p-1 shadow-card">
      <select
        aria-label="Year"
        className={selectClass}
        value={value.year}
        disabled={years.length === 0}
        onChange={(event) =>
          onChange({ year: Number(event.target.value), month: value.month })
        }
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        className={selectClass}
        value={value.month === null ? ALL_MONTHS : value.month}
        onChange={(event) =>
          onChange({
            year: value.year,
            month:
              event.target.value === ALL_MONTHS
                ? null
                : Number(event.target.value),
          })
        }
      >
        <option value={ALL_MONTHS}>Whole year</option>
        {months.map((month) => (
          <option key={month.month} value={month.month}>
            {monthLabel(month.month)}
          </option>
        ))}
        {/* A month reached by URL that this year does not hold still needs an
            option, or the select silently displays "Whole year" while the page
            says otherwise. It is offered disabled: it is where the reader is,
            not somewhere they may go. */}
        {uncovered === null ? null : (
          <option value={uncovered} disabled>
            {monthLabel(uncovered)} — no data
          </option>
        )}
      </select>
    </div>
  );
}
