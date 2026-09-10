import { Injectable, NotFoundException } from '@nestjs/common';
import { type ImportWarning, monthLabel, periodLabel } from '../imports/parse-workbook.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  type Assumptions,
  type Entry,
  type MonthModel,
  type ProjectRecord,
  buildMonthModels,
  entryCost,
  entryDirectCost,
  uncostedIndirect,
  isBillable,
  monthKey,
  ratio,
} from './cost-model.js';

const CURRENCY = 'AED';
/** "Equal to the dirham" -- the assessment's own tolerance. */
const BALANCE_TOLERANCE = 0.005;

type Scope = { year: number; month: number | null };

/** Arithmetic balance and dataset completeness are two different facts. */
type Completeness = {
  cost: 'complete' | 'partial';
  revenue: 'complete' | 'partial';
  issues: ImportWarning[];
};

type Context = {
  scope: Scope;
  entries: Entry[];
  models: Map<string, MonthModel>;
  projects: Map<string, ProjectRecord>;
  lifetimeHours: Map<string, number>;
  assumptions: Assumptions;
  completeness: Completeness;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async periods() {
    const rows = await this.availablePeriods();
    const years = new Map<number, { month: number; label: string; hasTimesheet: boolean; hasSalaries: boolean }[]>();

    for (const row of rows) {
      const list = years.get(row.year) ?? [];
      list.push({
        month: row.month,
        label: monthLabel(row.year, row.month),
        hasTimesheet: row.hasTimesheet,
        hasSalaries: row.hasSalaries,
      });
      years.set(row.year, list);
    }

    const available = [...years.entries()].map(([year, months]) => ({ year, months }));
    const defaultYear = available.length > 0 ? available[available.length - 1].year : null;

    return {
      years: available,
      defaultYear,
      hasData: available.length > 0,
      warnings:
        defaultYear === null
          ? []
          : (await this.load({ year: defaultYear, month: null })).completeness.issues,
    };
  }

  async dashboard(scope: Scope) {
    const context = await this.load(scope);
    const totals = this.totalsFor(context, context.entries);
    const reconciliation = this.reconcile(context);

    const booked = [...context.projects.values()].reduce((sum, project) => {
      if (project.price === null || project.salesYear !== scope.year) return sum;
      if (scope.month !== null && project.salesMonth !== scope.month) return sum;
      return sum + project.price;
    }, 0);

    return {
      period: this.describe(context),
      currency: CURRENCY,
      totals: {
        totalHours: hours2(totals.totalHours),
        billableHours: hours2(totals.billableHours),
        nonBillableHours: hours2(totals.totalHours - totals.billableHours),
        productivity: round4(ratio(totals.billableHours, totals.totalHours)),
        cost: round2(totals.cost),
        allocatedRevenue: round2(totals.allocatedRevenue),
        bookedRevenue: round2(booked),
        profit: round2(totals.profit),
        margin: round4(totals.margin),
      },
      reconciliation,
      completeness: context.completeness,
    };
  }

  async projectList(scope: Scope) {
    const context = await this.load(scope);
    const byRef = new Map<string, Entry[]>();
    for (const entry of context.entries) {
      byRef.set(entry.refCode, [...(byRef.get(entry.refCode) ?? []), entry]);
    }

    // Membership is decided by the CATEGORY, not by whether a price exists. A
    // billable ref with hours and no price is exactly the gap the brief asks us
    // to surface, so it belongs in the list with price null -- dropping it would
    // hide the work and the warning together. Internal categories are what gets
    // excluded.
    const refCodes = new Set<string>([
      ...[...byRef.entries()]
        .filter(([, rows]) => rows.some((row) => isBillable(row.category, context.assumptions)))
        .map(([ref]) => ref),
      ...[...context.projects.values()]
        .filter((p) => p.salesYear === scope.year && (scope.month === null || p.salesMonth === scope.month))
        .map((p) => p.refCode),
    ]);

    const projects = [...refCodes].map((refCode) => {
      const project = context.projects.get(refCode) ?? null;
      const rows = byRef.get(refCode) ?? [];
      const totals = this.totalsFor(context, rows);
      const lifetime = context.lifetimeHours.get(refCode) ?? 0;

      return {
        refCode,
        name: displayName(project, rows, refCode),
        client: clientOf(rows),
        category: project?.category ?? rows[0]?.category ?? null,
        status: project?.status ?? null,
        priced: project !== null && project.price !== null && project.price > 0,
        price: round2(project?.price ?? null),
        salesMonth:
          project?.salesYear == null || project?.salesMonth == null
            ? null
            : {
                year: project.salesYear,
                month: project.salesMonth,
                label: monthLabel(project.salesYear, project.salesMonth),
              },
        periodHours: hours2(totals.totalHours),
        periodCost: round2(totals.cost),
        periodAllocatedRevenue: round2(totals.allocatedRevenue),
        periodProfit: round2(totals.profit),
        periodMargin: round4(totals.margin),
        costComplete: totals.costComplete,
        lifetimeHours: hours2(lifetime),
        lifetimeShareOfHours: round4(ratio(totals.totalHours, lifetime)),
      };
    });

    projects.sort((a, b) => (b.periodHours ?? 0) - (a.periodHours ?? 0));

    return {
      period: this.describe(context),
      currency: CURRENCY,
      projects,
      completeness: context.completeness,
    };
  }

  /**
   * Never period-filtered: a price only means something against all of the
   * project's hours (spec A-002). The monthly split lives inside the response.
   */
  async projectDetail(refCode: string) {
    const project = await this.prisma.project.findUnique({ where: { refCode } });
    const rows = await this.prisma.timesheetEntry.findMany({ where: { refCode } });
    if (!project && rows.length === 0) throw new NotFoundException(`No project ${refCode}`);

    const months = [...new Set(rows.map((r) => monthKey(r.year, r.month)))].map((key) => {
      const [year, month] = key.split('-');
      return { year: Number(year), month: Number(month) };
    });

    const assumptions = await this.settings.read();
    const monthFilter = { OR: months.map((m) => ({ year: m.year, month: m.month })) };
    const [monthEntries, monthSalaries] = await Promise.all([
      this.prisma.timesheetEntry.findMany({ where: monthFilter }),
      this.prisma.salary.findMany({ where: monthFilter }),
    ]);
    const models = buildMonthModels(monthEntries, monthSalaries, assumptions);

    const lifetimeHours = rows.reduce((sum, r) => sum + r.hours, 0);
    const price = project?.price ?? null;

    const total = costOf(rows, models, assumptions);
    const cost = total.cost ?? 0;
    const costComplete = total.complete;

    const revenueComplete = price !== null && price > 0;
    const complete = costComplete && revenueComplete;
    const profit = complete && price !== null ? price - cost : null;

    const byMonth = months
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((m) => {
        const monthRows = rows.filter((r) => r.year === m.year && r.month === m.month);
        const hours = monthRows.reduce((sum, r) => sum + r.hours, 0);
        const monthCost = costOf(monthRows, models, assumptions);
        return {
          year: m.year,
          month: m.month,
          label: monthLabel(m.year, m.month),
          hours: hours2(hours),
          cost: round2(monthCost.cost),
          costComplete: monthCost.complete,
          allocatedRevenue: round2(allocate(price, hours, lifetimeHours)),
        };
      });

    const departments = groupBy(rows, (r) => r.department).map(([department, group]) => {
      const groupCost = costOf(group, models, assumptions);
      return {
        department,
        hours: hours2(sum(group, (r) => r.hours)),
        cost: round2(groupCost.cost),
        costComplete: groupCost.complete,
        shareOfHours: round4(ratio(sum(group, (r) => r.hours), lifetimeHours)),
      };
    });

    const employees = groupBy(rows, (r) => r.employeeNo).map(([employeeNo, group]) => {
      const hours = sum(group, (r) => r.hours);
      const employeeCost = costOf(group, models, assumptions);
      const revenueShare = allocate(price, hours, lifetimeHours);
      // Withheld whenever this person's cost is partial -- including when the
      // gap is somebody else's missing salary in a month they both worked.
      const showProfitability =
        employeeCost.complete && employeeCost.cost !== null && revenueShare !== null;
      return {
        employeeNo,
        name: group[0].employeeName,
        department: group[0].department,
        designation: group[0].designation,
        hours: hours2(hours),
        cost: round2(employeeCost.cost),
        costComplete: employeeCost.complete,
        revenueShare: round2(revenueShare),
        profitability: showProfitability
          ? round4(ratio(revenueShare - employeeCost.cost!, revenueShare))
          : null,
      };
    });

    const issues: ImportWarning[] = [];
    if (!revenueComplete) {
      issues.push({
        code: 'project_without_price',
        message: `${refCode} has no usable price, so its revenue, profit and profitability are unknown.`,
        context: { refCode },
      });
    }
    if (!costComplete) {
      issues.push({
        code: 'cost_partial',
        message: `Some hours on ${refCode} fall in months where a salary is missing, so this cost is partial.`,
        context: { refCode },
      });
    }

    return {
      refCode,
      name: displayName(project, rows, refCode),
      client: clientOf(rows),
      category: project?.category ?? null,
      status: project?.status ?? null,
      currency: CURRENCY,
      priced: revenueComplete,
      price: round2(price),
      salesMonth:
        project?.salesYear == null || project?.salesMonth == null
          ? null
          : {
              year: project.salesYear,
              month: project.salesMonth,
              label: monthLabel(project.salesYear, project.salesMonth),
            },
      totals: {
        hours: hours2(lifetimeHours),
        cost: round2(total.cost),
        costComplete,
        profit: round2(profit),
        // The assessment's project profitability, exactly: (price - cost) / price.
        profitability: complete && price !== null ? round4(ratio(price - cost, price)) : null,
      },
      months: byMonth,
      departments,
      employees,
      completeness: {
        cost: costComplete ? ('complete' as const) : ('partial' as const),
        revenue: revenueComplete ? ('complete' as const) : ('partial' as const),
        issues,
      },
    };
  }

  async departments(scope: Scope) {
    const context = await this.load(scope);

    const departments = groupBy(context.entries, (e) => e.department).map(([department, group]) => {
      const totals = this.totalsFor(context, group);
      const employees = groupBy(group, (e) => e.employeeNo).map(([employeeNo, rows]) => {
        const employeeTotals = this.totalsFor(context, rows);
        return {
          employeeNo,
          name: rows[0].employeeName,
          designation: rows[0].designation,
          totalHours: hours2(employeeTotals.totalHours),
          billableHours: hours2(employeeTotals.billableHours),
          productivity: round4(ratio(employeeTotals.billableHours, employeeTotals.totalHours)),
          cost: round2(employeeTotals.cost),
          costComplete: employeeTotals.costComplete,
          allocatedRevenue: round2(employeeTotals.allocatedRevenue),
          revenueComplete: employeeTotals.revenueComplete,
          profit: round2(employeeTotals.profit),
          margin: round4(employeeTotals.margin),
        };
      });

      return {
        department,
        totalHours: hours2(totals.totalHours),
        billableHours: hours2(totals.billableHours),
        nonBillableHours: hours2(totals.totalHours - totals.billableHours),
        productivity: round4(ratio(totals.billableHours, totals.totalHours)),
        cost: round2(totals.cost),
        costComplete: totals.costComplete,
        allocatedRevenue: round2(totals.allocatedRevenue),
        revenueComplete: totals.revenueComplete,
        profit: round2(totals.profit),
        margin: round4(totals.margin),
        employees,
      };
    });

    departments.sort((a, b) => b.totalHours - a.totalHours);

    return {
      period: this.describe(context),
      currency: CURRENCY,
      departments,
      completeness: context.completeness,
    };
  }

  async productivity(scope: Scope) {
    const context = await this.load(scope);
    const totals = this.totalsFor(context, context.entries);

    const employees = groupBy(context.entries, (e) => e.employeeNo).map(([employeeNo, rows]) => {
      const totalHours = sum(rows, (r) => r.hours);
      const billableHours = sum(
        rows.filter((r) => isBillable(r.category, context.assumptions)),
        (r) => r.hours,
      );
      return {
        employeeNo,
        name: rows[0].employeeName,
        department: rows[0].department,
        designation: rows[0].designation,
        typeOfExpense: rows[0].typeOfExpense,
        totalHours: hours2(totalHours),
        billableHours: hours2(billableHours),
        nonBillableHours: hours2(totalHours - billableHours),
        productivity: round4(ratio(billableHours, totalHours)),
      };
    });

    employees.sort((a, b) => (b.productivity ?? -1) - (a.productivity ?? -1));

    return {
      period: this.describe(context),
      companyProductivity: round4(ratio(totals.billableHours, totals.totalHours)),
      employees,
      completeness: context.completeness,
    };
  }

  async categories(scope: Scope) {
    const context = await this.load(scope);
    const totalHours = sum(context.entries, (e) => e.hours);

    const categories = groupBy(context.entries, (e) => e.category).map(([category, rows]) => {
      const hours = sum(rows, (r) => r.hours);
      let directCost: number | null = 0;
      for (const row of rows) {
        const value = entryDirectCost(row, context.models.get(monthKey(row.year, row.month)));
        if (value === null) directCost = null;
        else if (directCost !== null) directCost += value;
      }
      return {
        category,
        billable: isBillable(category, context.assumptions),
        hours: hours2(hours),
        shareOfTotal: round4(ratio(hours, totalHours)),
        directCost: round2(directCost),
      };
    });

    categories.sort((a, b) => b.hours - a.hours);

    const billableRows = categories.filter((c) => c.billable);
    const totalDirect = categories.reduce((s, c) => s + (c.directCost ?? 0), 0);

    return {
      period: this.describe(context),
      currency: CURRENCY,
      totalHours: hours2(totalHours),
      billableHours: hours2(billableRows.reduce((s, c) => s + c.hours, 0)),
      internalHours: hours2(categories.filter((c) => !c.billable).reduce((s, c) => s + c.hours, 0)),
      totalDirectCost: round2(totalDirect),
      billableDirectCost: round2(billableRows.reduce((s, c) => s + (c.directCost ?? 0), 0)),
      internalDirectCost: round2(
        categories.filter((c) => !c.billable).reduce((s, c) => s + (c.directCost ?? 0), 0),
      ),
      categories,
      completeness: context.completeness,
    };
  }

  // ---- internals -------------------------------------------------------

  /** Which (year, month) pairs hold data, and which kind. */
  private async availablePeriods() {
    const [timesheet, salaries] = await Promise.all([
      this.prisma.timesheetEntry.groupBy({ by: ['year', 'month'] }),
      this.prisma.salary.groupBy({ by: ['year', 'month'] }),
    ]);

    const periods = new Map<string, { year: number; month: number; hasTimesheet: boolean; hasSalaries: boolean }>();
    const mark = (rows: { year: number; month: number }[], key: 'hasTimesheet' | 'hasSalaries') => {
      for (const row of rows) {
        const id = `${row.year}-${row.month}`;
        const entry = periods.get(id) ?? {
          year: row.year,
          month: row.month,
          hasTimesheet: false,
          hasSalaries: false,
        };
        entry[key] = true;
        periods.set(id, entry);
      }
    };
    mark(timesheet, 'hasTimesheet');
    mark(salaries, 'hasSalaries');

    return [...periods.values()].sort((a, b) => a.year - b.year || a.month - b.month);
  }

  private async load(scope: Scope): Promise<Context> {
    const period = { year: scope.year, ...(scope.month === null ? {} : { month: scope.month }) };

    const [assumptions, entries, salaries, projectRows, lifetime] = await Promise.all([
      this.settings.read(),
      this.prisma.timesheetEntry.findMany({ where: period }),
      this.prisma.salary.findMany({ where: period }),
      this.prisma.project.findMany(),
      // Deliberately NOT filtered by period: this is the denominator for revenue
      // allocation, and narrowing it would credit each period with the whole price.
      this.prisma.timesheetEntry.groupBy({ by: ['refCode'], _sum: { hours: true } }),
    ]);

    const projects = new Map(projectRows.map((p) => [p.refCode, p]));
    const models = buildMonthModels(entries, salaries, assumptions);
    const lifetimeHours = new Map(lifetime.map((row) => [row.refCode, row._sum.hours ?? 0]));

    const issues: ImportWarning[] = [];
    let costComplete = true;
    let revenueComplete = true;

    for (const model of models.values()) {
      if (!model.poolComplete) {
        costComplete = false;
        for (const employeeNo of model.missingSalaryEmployees) {
          issues.push({
            code: 'employee_without_salary',
            message: `${employeeNo} logged hours in ${monthLabel(model.year, model.month)} with no salary on record. Every allocated cost in that month is partial.`,
            context: { employeeNo, year: model.year, month: model.month },
          });
        }
      }
      if (model.billableHours === 0 && model.pool > 0) {
        issues.push({
          code: 'no_billable_hours',
          message: `${monthLabel(model.year, model.month)} has no billable hours, so ${model.pool.toFixed(2)} ${CURRENCY} of cost could not be allocated to any project.`,
          context: { year: model.year, month: model.month },
        });
      }
    }

    const unpriced = new Set<string>();
    for (const entry of entries) {
      if (!isBillable(entry.category, assumptions)) continue;
      const project = projects.get(entry.refCode);
      if (!project || project.price === null || project.price <= 0) unpriced.add(entry.refCode);
    }
    if (unpriced.size > 0) {
      revenueComplete = false;
      for (const refCode of unpriced) {
        issues.push({
          code: 'project_without_price',
          message: `${refCode} has billable hours in this period and no usable price, so its revenue is unknown.`,
          context: { refCode },
        });
      }
    }

    if (entries.length > 0 && salaries.length === 0) {
      costComplete = false;
      issues.push({
        code: 'period_missing_salaries',
        message: 'No salary data is loaded for this period, so no cost can be calculated.',
      });
    }
    if (salaries.length > 0 && entries.length === 0) {
      issues.push({
        code: 'period_missing_timesheet',
        message: 'No timesheet data is loaded for this period.',
      });
    }

    return {
      scope,
      entries,
      models,
      projects,
      lifetimeHours,
      assumptions,
      completeness: {
        cost: costComplete ? 'complete' : 'partial',
        revenue: revenueComplete ? 'complete' : 'partial',
        issues,
      },
    };
  }

  /**
   * Figures for a set of rows, with completeness judged on those rows rather
   * than on the whole period -- so one department's gap does not withhold
   * another's margin, and a gap anywhere in a month still withholds every
   * group that touches that month.
   */
  private totalsFor(context: Context, rows: Entry[]) {
    let totalHours = 0;
    let billableHours = 0;
    let cost = 0;
    let allocatedRevenue = 0;
    let costComplete = true;
    let revenueComplete = true;

    for (const row of rows) {
      totalHours += row.hours;
      const model = context.models.get(monthKey(row.year, row.month));
      if (!model || !model.poolComplete) costComplete = false;

      const project = context.projects.get(row.refCode);
      const billable = isBillable(row.category, context.assumptions);

      if (billable) {
        billableHours += row.hours;
        const value = entryCost(row, model);
        if (value === null) costComplete = false;
        else cost += value;

        // Only billable work is expected to carry a price; an internal category
        // without one is not a gap.
        if (!project || project.price === null || project.price <= 0) revenueComplete = false;
      }

      // Denominator is the project's hours across every loaded period, never the
      // filtered period -- otherwise each period is credited the whole price.
      const allocated = allocate(
        project?.price ?? null,
        row.hours,
        context.lifetimeHours.get(row.refCode) ?? 0,
      );
      if (allocated !== null) allocatedRevenue += allocated;
    }

    const complete = costComplete && revenueComplete;

    return {
      totalHours,
      billableHours,
      cost,
      costComplete,
      allocatedRevenue,
      revenueComplete,
      // Withheld rather than shown as trustworthy when an input is missing.
      profit: complete ? allocatedRevenue - cost : null,
      margin: complete ? ratio(allocatedRevenue - cost, allocatedRevenue) : null,
    };
  }

  private reconcile(context: Context) {
    let knownSalaries = 0;
    let overhead = 0;
    let allocated = 0;
    let unallocated = 0;
    let uncosted = 0;
    let missingSalaryMonths = 0;
    let billableHours = 0;
    let uncostedBillableHours = 0;

    for (const model of context.models.values()) {
      knownSalaries += model.knownSalaries;
      overhead += model.overhead;
      billableHours += model.billableHours;
      uncostedBillableHours += model.uncostedBillableHours;
      missingSalaryMonths += model.missingSalaryEmployees.length;
      if (model.indirectRate === null) unallocated += model.pool;
      else uncosted += uncostedIndirect(model);
    }

    for (const row of context.entries) {
      if (!isBillable(row.category, context.assumptions)) continue;
      allocated += entryCost(row, context.models.get(monthKey(row.year, row.month))) ?? 0;
    }

    const expected = knownSalaries + overhead;
    const difference = allocated + unallocated + uncosted - expected;

    return {
      knownSalaries: round2(knownSalaries),
      overhead: round2(overhead),
      expectedCost: round2(expected),
      allocatedCost: round2(allocated),
      unallocatedCost: round2(unallocated),
      // Pool that fell on hours whose direct rate is unknown. Real cost that
      // belongs to nobody we can name -- surfaced instead of being pushed onto
      // the employees whose salaries happen to be on record.
      uncostedIndirectCost: round2(uncosted),
      difference: round2(difference),
      // Arithmetic only. Completeness is the two flags below.
      balances: Math.abs(difference) < BALANCE_TOLERANCE,
      salariesComplete: missingSalaryMonths === 0,
      employeeMonthsMissingSalary: missingSalaryMonths,
      billableHours: hours2(billableHours),
      billableHoursUncosted: hours2(uncostedBillableHours),
    };
  }

  private describe(context: Context) {
    const monthsCovered = new Set(context.entries.map((e) => monthKey(e.year, e.month))).size;
    return {
      year: context.scope.year,
      month: context.scope.month,
      label: periodLabel(context.scope.year, context.scope.month),
      monthsCovered: context.scope.month === null ? monthsCovered : 1,
    };
  }
}

// ---- helpers ------------------------------------------------------------

function allocate(price: number | null, hours: number, lifetimeHours: number): number | null {
  if (price === null || price <= 0 || lifetimeHours <= 0) return null;
  return price * (hours / lifetimeHours);
}

/**
 * Cost of a set of rows and whether that cost is the whole story.
 *
 * A month with a missing salary has an understated indirect rate, so EVERY row
 * in it is priced too low -- including rows belonging to people whose own
 * salary is known. Completeness is therefore a property of the months a group
 * touches, not only of the group's own employees.
 */
function costOf(
  rows: Entry[],
  models: Map<string, MonthModel>,
  assumptions: Assumptions,
): { cost: number | null; complete: boolean } {
  let cost: number | null = 0;
  let complete = true;

  for (const row of rows) {
    const model = models.get(monthKey(row.year, row.month));
    if (!model || !model.poolComplete) complete = false;
    if (!isBillable(row.category, assumptions)) continue;

    const value = entryCost(row, model);
    if (value === null) {
      complete = false;
      cost = null;
    } else if (cost !== null) {
      cost += value;
    }
  }

  return { cost, complete };
}

/**
 * A project with no price row still has a name in the timesheet: the task-name
 * column. Falling back to it, then to the ref code, is what lets an unpriced
 * project stay visible and openable.
 */
function displayName(
  project: ProjectRecord | null,
  rows: Entry[],
  refCode: string,
): string {
  return project?.name ?? rows.find((row) => row.taskName !== null)?.taskName ?? refCode;
}

/** The billable rows carry the client on the company-name column. */
function clientOf(rows: Entry[]): string | null {
  return rows.find((row) => row.companyName !== null)?.companyName ?? null;
}

function groupBy<T>(rows: T[], key: (row: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    groups.set(k, [...(groups.get(k) ?? []), row]);
  }
  return [...groups.entries()];
}

function sum<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}

/** The one place rounding happens; non-finite becomes null, margins are never clamped. */
function round2(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/** For hours and other sums that are always finite. */
function hours2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}
