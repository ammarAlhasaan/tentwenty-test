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
  projects: (period: PeriodSelection) =>
    ["analytics", "projects", period.year, period.month] as const,
  project: (refCode: string) => ["analytics", "project", refCode] as const,
  departments: (period: PeriodSelection) =>
    ["analytics", "departments", period.year, period.month] as const,
  productivity: (period: PeriodSelection) =>
    ["analytics", "productivity", period.year, period.month] as const,
  categories: (period: PeriodSelection) =>
    ["analytics", "categories", period.year, period.month] as const,
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
    hasData: boolean;
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

export type PeriodDescriptor = {
  year: number;
  month: number | null;
  label: string;
  monthsCovered: number;
};

export type Completeness = {
  cost: "complete" | "partial";
  revenue: "complete" | "partial";
  issues: { code: string; message: string; context?: unknown }[];
};

export type ProjectRow = {
  refCode: string;
  name: string;
  client: string | null;
  category: string | null;
  status: string | null;
  priced: boolean;
  price: number | null;
  salesMonth: { year: number; month: number; label: string } | null;
  periodHours: number | null;
  periodCost: number | null;
  periodAllocatedRevenue: number | null;
  periodProfit: number | null;
  periodMargin: number | null;
  costComplete: boolean;
  lifetimeHours: number | null;
  lifetimeShareOfHours: number | null;
};

export type ProjectsResponse = {
  period: PeriodDescriptor;
  currency: string;
  projects: ProjectRow[];
  completeness: Completeness;
};

export type ProjectDetailResponse = {
  refCode: string;
  name: string;
  client: string | null;
  category: string | null;
  status: string | null;
  currency: string;
  priced: boolean;
  price: number | null;
  salesMonth: { year: number; month: number; label: string } | null;
  totals: {
    hours: number | null;
    cost: number | null;
    costComplete: boolean;
    profit: number | null;
    profitability: number | null;
  };
  departments: {
    department: string;
    hours: number | null;
    cost: number | null;
    costComplete: boolean;
    shareOfHours: number | null;
  }[];
  employees: {
    employeeNo: string;
    name: string;
    department: string | null;
    designation: string | null;
    hours: number | null;
    cost: number | null;
    costComplete: boolean;
    revenueShare: number | null;
    profitability: number | null;
  }[];
  completeness: Completeness;
};

export type DepartmentEmployee = {
  employeeNo: string;
  name: string;
  designation: string | null;
  totalHours: number | null;
  billableHours: number | null;
  cost: number | null;
  costComplete: boolean;
};

export type DepartmentsResponse = {
  period: PeriodDescriptor;
  currency: string;
  departments: {
    department: string;
    totalHours: number | null;
    billableHours: number | null;
    nonBillableHours: number | null;
    cost: number | null;
    costComplete: boolean;
    employees: DepartmentEmployee[];
  }[];
  completeness: Completeness;
};

export type ProductivityResponse = {
  period: PeriodDescriptor;
  companyProductivity: number | null;
  employees: {
    employeeNo: string;
    name: string;
    department: string | null;
    designation: string | null;
    typeOfExpense: string | null;
    totalHours: number | null;
    billableHours: number | null;
    nonBillableHours: number | null;
    productivity: number | null;
  }[];
};

export type CategoriesResponse = {
  period: PeriodDescriptor;
  totalHours: number | null;
  billableHours: number | null;
  internalHours: number | null;
  categories: {
    category: string;
    billable: boolean;
    hours: number | null;
    shareOfTotal: number | null;
  }[];
};

/** `year` is required by every period-scoped endpoint; `month` narrows it. */
function periodQuery(period: PeriodSelection): string {
  const query = new URLSearchParams({ year: String(period.year) });
  if (period.month !== null) query.set("month", String(period.month));
  return query.toString();
}

export function fetchPeriods(signal?: AbortSignal): Promise<PeriodsResponse> {
  return apiFetch<PeriodsResponse>("/periods", { signal });
}

export function fetchDashboard(
  period: PeriodSelection,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/dashboard?${periodQuery(period)}`, {
    signal,
  });
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

export function useProjects(period: PeriodSelection, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: analyticsKeys.projects(period),
      queryFn: ({ signal }) =>
        apiFetch<ProjectsResponse>(`/projects?${periodQuery(period)}`, {
          signal,
        }),
      enabled,
    }),
  );
}

export function useProject(refCode: string, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: analyticsKeys.project(refCode),
      queryFn: ({ signal }) =>
        apiFetch<ProjectDetailResponse>(
          // Not period-filtered: a price only means something against all of the
          // project's hours. The month-by-month split is inside the response.
          `/projects/${encodeURIComponent(refCode)}`,
          { signal },
        ),
      enabled,
    }),
  );
}

export function useDepartments(period: PeriodSelection, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: analyticsKeys.departments(period),
      queryFn: ({ signal }) =>
        apiFetch<DepartmentsResponse>(`/departments?${periodQuery(period)}`, {
          signal,
        }),
      enabled,
    }),
  );
}

export function useProductivity(period: PeriodSelection, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: analyticsKeys.productivity(period),
      queryFn: ({ signal }) =>
        apiFetch<ProductivityResponse>(`/productivity?${periodQuery(period)}`, {
          signal,
        }),
      enabled,
    }),
  );
}

export function useCategories(period: PeriodSelection, enabled: boolean) {
  return useQuery(
    queryOptions({
      queryKey: analyticsKeys.categories(period),
      queryFn: ({ signal }) =>
        apiFetch<CategoriesResponse>(`/categories?${periodQuery(period)}`, {
          signal,
        }),
      enabled,
    }),
  );
}
