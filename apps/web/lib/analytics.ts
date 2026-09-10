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

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export const analyticsKeys = {
  /** What imports and settings saves invalidate. */
  all: ["analytics"] as const,
  periods: () => ["analytics", "periods"] as const,
  project: (refCode: string) => ["analytics", "project", refCode] as const,
};

/** `month: null` means the whole year — the API's own convention. */
export type PeriodSelection = { year: number; month: number | null };

export type PeriodMonth = {
  month: number;
  label: string;
};

export type PeriodsResponse = {
  years: { year: number; months: PeriodMonth[] }[];
  defaultYear: number | null;
  hasData: boolean;
  warnings: { code: string; message: string }[];
};

export type DashboardResponse = {
  period: PeriodDescriptor;
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
  periodHours: number | null;
  periodCost: number | null;
  periodAllocatedRevenue: number | null;
  periodProfit: number | null;
  periodMargin: number | null;
  costComplete: boolean;
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

/** Every period-scoped endpoint takes `year`; `month` narrows it to one month. */
function periodQuery(period: PeriodSelection): string {
  const query = new URLSearchParams({ year: String(period.year) });
  if (period.month !== null) query.set("month", String(period.month));
  return query.toString();
}

/**
 * Reporting data changes only when a spreadsheet is imported or an assumption is
 * saved, and both of those invalidate `["analytics"]` explicitly
 * (`lib/imports.ts`, `lib/settings.ts`). Because invalidation is trustworthy,
 * these queries do not need the client's 30s default: without this, walking
 * Dashboard → Projects → Dashboard refetches everything for no reason.
 *
 * `["auth", "me"]` keeps the 30s default on purpose — see README 3.8.
 */
const REPORTING_STALE_TIME = 5 * 60_000;

/**
 * `enabled` comes from the caller's resolved authenticated state: a private
 * query must not start while the session is unresolved or signed out, or its
 * 401 would race the sign-in it is waiting for (README 4.9).
 */
export function usePeriods(enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.periods(),
    queryFn: ({ signal }) => apiFetch<PeriodsResponse>("/periods", { signal }),
    staleTime: REPORTING_STALE_TIME,
    enabled,
  });
}

/**
 * The five period-scoped reports share one rule: each is `/<resource>` taking
 * `year` and `month`, cached under `["analytics", resource, year, month]`. One
 * function says that once instead of five near-identical hooks saying it apart.
 *
 * `keepPreviousData` is what makes a period change readable: the table dims
 * rather than blanking to a skeleton on every month.
 */
function usePeriodReport<T>(
  resource: "dashboard" | "projects" | "departments" | "productivity" | "categories",
  period: PeriodSelection,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["analytics", resource, period.year, period.month] as const,
    queryFn: ({ signal }) =>
      apiFetch<T>(`/${resource}?${periodQuery(period)}`, { signal }),
    placeholderData: keepPreviousData,
    staleTime: REPORTING_STALE_TIME,
    enabled,
  });
}

export function useDashboard(period: PeriodSelection, enabled: boolean) {
  return usePeriodReport<DashboardResponse>("dashboard", period, enabled);
}

export function useProjects(period: PeriodSelection, enabled: boolean) {
  return usePeriodReport<ProjectsResponse>("projects", period, enabled);
}

export function useDepartments(period: PeriodSelection, enabled: boolean) {
  return usePeriodReport<DepartmentsResponse>("departments", period, enabled);
}

export function useProductivity(period: PeriodSelection, enabled: boolean) {
  return usePeriodReport<ProductivityResponse>("productivity", period, enabled);
}

export function useCategories(period: PeriodSelection, enabled: boolean) {
  return usePeriodReport<CategoriesResponse>("categories", period, enabled);
}

/**
 * Not period-scoped, so it stays explicit: a price only means something against
 * all of the project's hours.
 */
export function useProject(refCode: string, enabled: boolean) {
  return useQuery({
    queryKey: analyticsKeys.project(refCode),
    queryFn: ({ signal }) =>
      apiFetch<ProjectDetailResponse>(
        `/projects/${encodeURIComponent(refCode)}`,
        { signal },
      ),
    staleTime: REPORTING_STALE_TIME,
    enabled,
  });
}
