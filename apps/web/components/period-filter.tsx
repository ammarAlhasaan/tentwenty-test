"use client";

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

export function monthLabel(month: number): string {
  return MONTHS[month - 1] ?? "";
}

export function periodLabel(year: number, month: number): string {
  return `${monthLabel(month)} ${year}`;
}

const selectClass =
  "rounded-[9px] bg-transparent px-2 py-1.5 text-[13.5px] font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Native selects: they are the control the platform already gives a keyboard and
 * a phone, and the design uses the same. Controlled by the caller, which owns
 * where the selection is stored.
 */
export function PeriodFilter({
  year,
  month,
  years,
  onChange,
}: {
  year: number;
  month: number;
  years: readonly number[];
  onChange: (period: { year: number; month: number }) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[13px] border border-border bg-card p-1 shadow-card">
      <select
        aria-label="Year"
        className={selectClass}
        value={year}
        onChange={(event) =>
          onChange({ year: Number(event.target.value), month })
        }
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        className={selectClass}
        value={month}
        onChange={(event) =>
          onChange({ year, month: Number(event.target.value) })
        }
      >
        {MONTHS.map((label, index) => (
          <option key={label} value={index + 1}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
