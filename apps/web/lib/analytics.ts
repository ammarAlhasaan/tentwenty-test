"use client";

/**
 * The reporting feature's endpoints and React Query definitions.
 *
 * Types are duplicated from `apps/api`'s contract rather than shared, per the
 * HTTP-only boundary. Only the fields this frontend actually renders are
 * declared; the API sends more, and ignoring the rest is deliberate.
 *
 * Keys start with `"analytics"`, so `isPrivateQuery` treats them as one signed-in
 * user's data and a session change clears them with no registration step
 * (apps/web/README.md, 4.5).
 */

import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export const analyticsKeys = {
  all: ["analytics"] as const,
  periods: () => ["analytics", "periods"] as const,
  dashboard: (period: PeriodSelection) =>
    ["analytics", "dashboard", period.year, period.month] as const,
};

/** `month: null` means the whole year — the API's own convention. */
export type PeriodSelection = { year: number; month: number | null };

export type PeriodMonth = {
  month: number;
  label: string;
  hasTimesheet: boolean;
  hasSalaries: boolean;
};

export type PeriodsResponse = {
  years: { year: number; months: PeriodMonth[] }[];
  defaultYear: number | null;
  hasData: boolean;
  warnings: { code: string; message: string }[];
};

export type DashboardResponse = {
  period: {
    year: number;
    month: number | null;
    label: string;
    monthsCovered: number;
  };
  currency: string;
  totals: {
    totalHours: number | null;
    billableHours: number | null;
    nonBillableHours: number | null;
    /** A ratio, 0–1 — not a percentage. */
    productivity: number | null;
    cost: number | null;
    allocatedRevenue: number | null;
    bookedRevenue: number | null;
    profit: number | null;
    /** A ratio. Signed, unbounded, and `null` when an input is partial. */
    margin: number | null;
  };
  reconciliation: {
    overhead: number;
    knownSalaries: number;
    balances: boolean;
    salariesComplete: boolean;
    employeeMonthsMissingSalary: number;
  };
  completeness: {
    cost: "complete" | "partial";
    revenue: "complete" | "partial";
    issues: { code: string; message: string; context?: unknown }[];
  };
};

export function fetchPeriods(signal?: AbortSignal): Promise<PeriodsResponse> {
  return apiFetch<PeriodsResponse>("/periods", { signal });
}

export function fetchDashboard(
  period: PeriodSelection,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const query = new URLSearchParams({ year: String(period.year) });
  if (period.month !== null) query.set("month", String(period.month));

  return apiFetch<DashboardResponse>(`/dashboard?${query}`, { signal });
}

/**
 * `enabled` comes from the caller's resolved authenticated state: a private
 * query must not start while the session is unresolved or signed out, or its
 * 401 would race the sign-in it is waiting for (README 4.9).
 */
export function periodsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: analyticsKeys.periods(),
    queryFn: ({ signal }) => fetchPeriods(signal),
    enabled,
  });
}

export function dashboardQueryOptions(
  period: PeriodSelection,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: analyticsKeys.dashboard(period),
    queryFn: ({ signal }) => fetchDashboard(period, signal),
    enabled,
  });
}

export function usePeriods(enabled: boolean) {
  return useQuery(periodsQueryOptions(enabled));
}

export function useDashboard(period: PeriodSelection, enabled: boolean) {
  return useQuery(dashboardQueryOptions(period, enabled));
}
