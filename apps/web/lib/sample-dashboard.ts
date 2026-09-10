/**
 * Sample figures for the Dashboard layout. **Not an API integration.**
 *
 * The assessment endpoints (`GET /periods`, `GET /dashboard`) are specified on
 * the unlanded branch `004-assessment-backend` and do not exist on `main`, so
 * there is nothing to call yet. Rather than leave the approved layout
 * undemonstrable, it renders these figures and says on screen, on every render,
 * that they are sample data.
 *
 * Two rules keep that honest:
 *
 * 1. **Nothing here is calculated.** Every derived value — productivity, profit,
 *    margin — is a literal, exactly as FE-01's placeholder page was. `apps/api`
 *    owns the cost model; recreating any part of it here would be a second
 *    implementation of the thing the assessment is actually about.
 * 2. **Nothing here goes through `apiFetch`.** No request is made, so no request
 *    can be mistaken for a working integration.
 *
 * The shape mirrors the documented `GET /dashboard` response so the swap is a
 * small one: add `lib/analytics.ts` (endpoint functions, query keys, `enabled`
 * gating and `signal` forwarding per README section 10), point `DashboardView`
 * at the query, and delete this file.
 */

export type DashboardTotals = {
  totalHours: number | null;
  billableHours: number | null;
  /** A ratio, 0–1 — not a percentage. */
  productivity: number | null;
  cost: number | null;
  allocatedRevenue: number | null;
  bookedRevenue: number | null;
  profit: number | null;
  /** A ratio. Unbounded and signed; a loss reports a negative margin. */
  margin: number | null;
};

export type DashboardCompleteness = {
  cost: "complete" | "partial";
  revenue: "complete" | "partial";
  issues: { code: string; message: string }[];
};

/**
 * A standing data-quality problem that does not invalidate the period on screen.
 * Kept separate from `completeness` because the two answer different questions:
 * completeness says whether *these* figures can be trusted, a warning says the
 * dataset has a gap somewhere.
 */
export type DataWarning = { code: string; message: string };

export type DashboardSnapshot = {
  period: { year: number; month: number; label: string };
  currency: string;
  overhead: number;
  peopleWhoLoggedTime: number;
  totals: DashboardTotals;
  completeness: DashboardCompleteness;
  warnings: DataWarning[];
};

/** The one period the sample covers. Any other period shows the empty state. */
export const SAMPLE_PERIOD = { year: 2026, month: 3 } as const;

export const SAMPLE_YEARS = [2026, 2025] as const;

const snapshot: DashboardSnapshot = {
  period: { year: 2026, month: 3, label: "March 2026" },
  currency: "AED",
  overhead: 60000,
  peopleWhoLoggedTime: 10,
  totals: {
    totalHours: 1642.9,
    billableHours: 1230.7,
    productivity: 0.7491,
    cost: 316000,
    allocatedRevenue: 366000,
    bookedRevenue: 384000,
    profit: 50000,
    margin: 0.1366,
  },
  // March 2026 ties: every person who logged hours has a salary, and every ref
  // code with billable hours has a price. So profit and margin are reported
  // rather than withheld, and the banner is allowed to answer the question.
  completeness: {
    cost: "complete",
    revenue: "complete",
    issues: [],
  },
  // Gaps elsewhere in the dataset. They do not touch March's arithmetic, which
  // is exactly why they are reported separately from `completeness`.
  warnings: [
    {
      code: "period_missing_salaries",
      message:
        "April 2026 has timesheet rows but no salary data, so no cost can be calculated for it.",
    },
    {
      code: "project_without_price",
      message:
        "P-2399 “Legacy migration” carries billable hours and has no price row, so its revenue is unknown wherever it appears.",
    },
  ],
};

export const SAMPLE_DASHBOARD: DashboardSnapshot = Object.freeze(snapshot);
