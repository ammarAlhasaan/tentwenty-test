/**
 * Display formatting for the figures on screen.
 *
 * Every function returns an em dash for null/undefined and a formatted zero for
 * 0. The distinction matters: an employee with no salary row is not an employee
 * paid nothing, and rendering the first as "AED 0" would hide a data gap the
 * brief asks us to surface.
 */

const ABSENT = "—";

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const hours = new Intl.NumberFormat("en-AE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-AE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? ABSENT : currency.format(value);
}

export function formatHours(value: number | null | undefined): string {
  return value == null ? ABSENT : `${hours.format(value)} h`;
}

/** Takes a ratio, not a percentage: 0.42 renders as "+42.0%". */
export function formatPercent(value: number | null | undefined): string {
  return value == null ? ABSENT : percent.format(value);
}
