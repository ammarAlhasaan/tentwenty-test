/**
 * Display formatting for the figures on screen.
 *
 * Every function returns an em dash for null/undefined and a formatted zero for
 * 0. The distinction matters: an employee with no salary row is not an employee
 * paid nothing, and rendering the first as "AED 0" would hide a data gap the
 * brief asks us to surface.
 */

export const ABSENT = "—";

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const hours = new Intl.NumberFormat("en-AE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("en-AE", {
  maximumFractionDigits: 1,
});

const signedPercent = new Intl.NumberFormat("en-AE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const sharePercent = new Intl.NumberFormat("en-AE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Rounded to whole dirhams for display; the API reports money to two places. */
export function formatCurrency(value: number | null | undefined): string {
  return value == null ? ABSENT : currency.format(value);
}

export function formatHours(value: number | null | undefined): string {
  return value == null ? ABSENT : `${hours.format(value)} h`;
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? ABSENT : number.format(value);
}

/**
 * A signed result — margin, profitability. Takes a ratio, not a percentage:
 * 0.42 renders as "+42.0%". The sign is shown because the reader needs to know
 * a margin went negative at a glance.
 */
export function formatPercent(value: number | null | undefined): string {
  return value == null ? ABSENT : signedPercent.format(value);
}

/**
 * A share of a whole — productivity, share of hours. Also a ratio, but never
 * signed: "+77.0% of logged time" would read as a change rather than a portion.
 */
export function formatShare(value: number | null | undefined): string {
  return value == null ? ABSENT : sharePercent.format(value);
}
