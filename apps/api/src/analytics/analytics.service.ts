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
  costOf,
  isBillable,
  monthKey,
  ratio,
  uncostedIndirect,
} from './cost-model.js';

const CURRENCY = 'AED';
/** "Equal to the dirham" -- the assessment's own tolerance. */
const BALANCE_TOLERANCE = 0.005;

type Scope = { year: number; month: number | null };

/**
 * Arithmetic and completeness are separate facts. A cost figure is always the
 * cost of what could be costed; these flags say whether that is everything.
 * Anything divided by an incomplete input is withheld as null.
 */
type Completeness = {
  cost: 'complete' | 'partial';
  revenue: 'complete' | 'partial';
  issues: ImportWarning[];
};

/** Everything the cost-bearing pages need, read once per request. */
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
    const [timesheet, salaries] = await Promise.all([
      this.prisma.timesheetEntry.groupBy({ by: ['year', 'month'] }),
      this.prisma.salary.groupBy({ by: ['year', 'month'] }),
    ]);

    const months = new Map<string, { year: number; month: number; hasTimesheet: boolean; hasSalaries: boolean }>();
    const mark = (rows: { year: number; month: number }[], key: 'hasTimesheet' | 'hasSalaries') => {
      for (const row of rows) {
        const id = monthKey(row.year, row.month);
        const entry = months.get(id) ?? {
          year: row.year,
          month: row.month,
          hasTimesheet: false,
          hasSalaries: false,
        };
        entry[key] = true;
        months.set(id, entry);
      }
    };
    mark(timesheet, 'hasTimesheet');
    mark(salaries, 'hasSalaries');

    const years = new Map<number, { month: number; label: string; hasTimesheet: boolean; hasSalaries: boolean }[]>();
    for (const m of [...months.values()].sort((a, b) => a.year - b.year || a.month - b.month)) {
      const list = years.get(m.year) ?? [];
      list.push({
        month: m.month,
        label: monthLabel(m.year, m.month),
        hasTimesheet: m.hasTimesheet,
        hasSalaries: m.hasSalaries,
      });
      years.set(m.year, list);
    }

    const available = [...years.entries()].map(([year, list]) => ({ year, months: list }));
    const defaultYear = available.length > 0 ? available[available.length - 1].year : null;

    return {
      years: available,
      defaultYear,
      hasData: available.length > 0,
      // The standing data-quality gaps -- missing salaries, unpriced projects --
      // recomputed on read, so uploading the missing file clears them. This is
      // why /periods loads the cost model even though it reports no figures.
      warnings:
        defaultYear === null
          ? []
          : (await this.load({ year: defaultYear, month: null })).completeness.issues,
    };
  }

  async dashboard(scope: Scope) {
    const context = await this.load(scope);
    const totals = this.totalsFor(context, context.entries);

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
        profit: round2(totals.profit),
        margin: round4(totals.margin),
      },
      reconciliation: this.reconcile(context),
      completeness: context.completeness,
    };
  }

  async projectList(scope: Scope) {
    const context = await this.load(scope);
    const byRef = groupBy(context.entries, (row) => row.refCode);

    // Membership follows the CATEGORY, not whether a price exists: a billable
    // ref with hours and no price is the gap the brief asks us to surface, so
    // it belongs in the list. Internal categories are what gets excluded.
    const refCodes = new Set<string>([
      ...byRef
        .filter(([, rows]) => rows.some((row) => isBillable(row.category, context.assumptions)))
        .map(([ref]) => ref),
      ...[...context.projects.values()]
        .filter((p) => p.salesYear === scope.year && (scope.month === null || p.salesMonth === scope.month))
        .map((p) => p.refCode),
    ]);

    const rowsByRef = new Map(byRef);
    const projects = [...refCodes].map((refCode) => {
      const project = context.projects.get(refCode) ?? null;
      const rows = rowsByRef.get(refCode) ?? [];
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
        salesMonth: salesMonthOf(project),
        periodHours: hours2(totals.totalHours),
        periodCost: round2(totals.cost),
        costComplete: totals.costComplete,
        periodAllocatedRevenue: round2(totals.allocatedRevenue),
        periodProfit: round2(totals.profit),
        periodMargin: round4(totals.margin),
        lifetimeHours: hours2(lifetime),
        lifetimeShareOfHours: round4(ratio(totals.totalHours, lifetime)),
      };
    });

    projects.sort((a, b) => b.periodHours - a.periodHours);

    return {
      period: this.describe(context),
      currency: CURRENCY,
      projects,
      completeness: context.completeness,
    };
  }

  /**
   * Never period-filtered: a price only means something against all of the
   * project's hours.
   */
  async projectDetail(refCode: string) {
    const [project, rows] = await Promise.all([
      this.prisma.project.findUnique({ where: { refCode } }),
      this.prisma.timesheetEntry.findMany({ where: { refCode } }),
    ]);
    if (!project && rows.length === 0) throw new NotFoundException(`No project ${refCode}`);

    const months = [...new Set(rows.map((row) => monthKey(row.year, row.month)))].map((key) => {
      const [year, month] = key.split('-');
      return { year: Number(year), month: Number(month) };
    });

    const assumptions = await this.settings.read();
    const monthFilter = { OR: months.map((m) => ({ year: m.year, month: m.month })) };
    const [monthEntries, monthSalaries] = await Promise.all([
      months.length === 0 ? [] : this.prisma.timesheetEntry.findMany({ where: monthFilter }),
      months.length === 0 ? [] : this.prisma.salary.findMany({ where: monthFilter }),
    ]);
    const models = buildMonthModels(monthEntries, monthSalaries, assumptions);

    const lifetimeHours = sum(rows, (row) => row.hours);
    const price = project?.price ?? null;
    const total = costOf(rows, models, assumptions);
    const priced = price !== null && price > 0;
    const complete = total.complete && priced;

    const issues: ImportWarning[] = [];
    if (!priced) {
      issues.push({
        code: 'project_without_price',
        message: `${refCode} has no usable price, so its revenue, profit and profitability are unknown.`,
        context: { refCode },
      });
    }
    if (!total.complete) {
      issues.push({
        code: 'cost_partial',
        message: `Some hours on ${refCode} fall in months where a salary is missing, so this cost covers only part of the work.`,
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
      priced,
      price: round2(price),
      salesMonth: salesMonthOf(project),
      totals: {
        hours: hours2(lifetimeHours),
        cost: round2(total.cost),
        costComplete: total.complete,
        profit: complete && price !== null ? round2(price - total.cost) : null,
        // The assessment's project profitability, exactly.
        profitability: complete && price !== null ? round4(ratio(price - total.cost, price)) : null,
      },
      departments: groupBy(rows, (row) => row.department).map(([department, group]) => {
        const groupCost = costOf(group, models, assumptions);
        return {
          department,
          hours: hours2(sum(group, (row) => row.hours)),
          cost: round2(groupCost.cost),
          costComplete: groupCost.complete,
          shareOfHours: round4(ratio(sum(group, (row) => row.hours), lifetimeHours)),
        };
      }),
      employees: groupBy(rows, (row) => row.employeeNo).map(([employeeNo, group]) => {
        const hours = sum(group, (row) => row.hours);
        const employeeCost = costOf(group, models, assumptions);
        const revenueShare = allocate(price, hours, lifetimeHours);
        return {
          employeeNo,
          name: group[0].employeeName,
          department: group[0].department,
          designation: group[0].designation,
          hours: hours2(hours),
          cost: round2(employeeCost.cost),
          costComplete: employeeCost.complete,
          revenueShare: round2(revenueShare),
          // Withheld whenever this person's cost is partial -- including when
          // the gap is somebody else's missing salary in a month they shared.
          profitability:
            employeeCost.complete && revenueShare !== null
              ? round4(ratio(revenueShare - employeeCost.cost, revenueShare))
              : null,
        };
      }),
      completeness: {
        cost: total.complete ? ('complete' as const) : ('partial' as const),
        revenue: priced ? ('complete' as const) : ('partial' as const),
        issues,
      },
    };
  }

  /** Hours and cost per department, and the people inside each one. */
  async departments(scope: Scope) {
    const context = await this.load(scope);

    const departments = groupBy(context.entries, (row) => row.department).map(([department, group]) => {
      const totals = this.totalsFor(context, group);
      return {
        department,
        totalHours: hours2(totals.totalHours),
        billableHours: hours2(totals.billableHours),
        nonBillableHours: hours2(totals.totalHours - totals.billableHours),
        cost: round2(totals.cost),
        costComplete: totals.costComplete,
        employees: groupBy(group, (row) => row.employeeNo).map(([employeeNo, rows]) => {
          const employee = this.totalsFor(context, rows);
          return {
            employeeNo,
            name: rows[0].employeeName,
            designation: rows[0].designation,
            totalHours: hours2(employee.totalHours),
            billableHours: hours2(employee.billableHours),
            cost: round2(employee.cost),
            costComplete: employee.costComplete,
          };
        }),
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

  /**
   * Hours only, so it needs neither salaries nor prices -- just the rows and
   * which categories count as billable.
   */
  async productivity(scope: Scope) {
    const { entries, assumptions, period } = await this.loadHours(scope);

    const totalHours = sum(entries, (row) => row.hours);
    const billableHours = sum(
      entries.filter((row) => isBillable(row.category, assumptions)),
      (row) => row.hours,
    );

    const employees = groupBy(entries, (row) => row.employeeNo).map(([employeeNo, rows]) => {
      const total = sum(rows, (row) => row.hours);
      const billable = sum(
        rows.filter((row) => isBillable(row.category, assumptions)),
        (row) => row.hours,
      );
      return {
        employeeNo,
        name: rows[0].employeeName,
        department: rows[0].department,
        designation: rows[0].designation,
        typeOfExpense: rows[0].typeOfExpense,
        totalHours: hours2(total),
        billableHours: hours2(billable),
        nonBillableHours: hours2(total - billable),
        productivity: round4(ratio(billable, total)),
      };
    });

    employees.sort((a, b) => (b.productivity ?? -1) - (a.productivity ?? -1));

    return {
      period,
      companyProductivity: round4(ratio(billableHours, totalHours)),
      employees,
    };
  }

  /** Hours per category. Same lightweight read as productivity. */
  async categories(scope: Scope) {
    const { entries, assumptions, period } = await this.loadHours(scope);
    const totalHours = sum(entries, (row) => row.hours);

    const categories = groupBy(entries, (row) => row.category).map(([category, rows]) => {
      const hours = sum(rows, (row) => row.hours);
      return {
        category,
        billable: isBillable(category, assumptions),
        hours: hours2(hours),
        shareOfTotal: round4(ratio(hours, totalHours)),
      };
    });

    categories.sort((a, b) => b.hours - a.hours);

    return {
      period,
      totalHours: hours2(totalHours),
      billableHours: hours2(categories.filter((c) => c.billable).reduce((s, c) => s + c.hours, 0)),
      internalHours: hours2(categories.filter((c) => !c.billable).reduce((s, c) => s + c.hours, 0)),
      categories,
    };
  }

  // ---- internals -------------------------------------------------------

  /** Rows and the billable-category assumption. Nothing else is read. */
  private async loadHours(scope: Scope) {
    const [assumptions, entries] = await Promise.all([
      this.settings.read(),
      this.prisma.timesheetEntry.findMany({ where: periodWhere(scope) }),
    ]);
    return { entries, assumptions, period: describePeriod(scope, entries) };
  }

  private async load(scope: Scope): Promise<Context> {
    const [assumptions, entries, salaries, projectRows, lifetime] = await Promise.all([
      this.settings.read(),
      this.prisma.timesheetEntry.findMany({ where: periodWhere(scope) }),
      this.prisma.salary.findMany({ where: periodWhere(scope) }),
      this.prisma.project.findMany(),
      // Deliberately NOT period-filtered: this is the denominator for revenue
      // allocation, and narrowing it would credit each period with the whole price.
      this.prisma.timesheetEntry.groupBy({ by: ['refCode'], _sum: { hours: true } }),
    ]);

    const projects = new Map(projectRows.map((row) => [row.refCode, row]));
    const models = buildMonthModels(entries, salaries, assumptions);

    const issues: ImportWarning[] = [];
    let costComplete = true;
    let revenueComplete = true;

    for (const model of models.values()) {
      if (!model.poolComplete) {
        costComplete = false;
        for (const employeeNo of model.missingSalaryEmployees) {
          issues.push({
            code: 'employee_without_salary',
            message: `${employeeNo} logged hours in ${monthLabel(model.year, model.month)} with no salary on record. Every allocated cost in that month covers only part of the work.`,
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
    for (const row of entries) {
      if (!isBillable(row.category, assumptions)) continue;
      const project = projects.get(row.refCode);
      if (!project || project.price === null || project.price <= 0) unpriced.add(row.refCode);
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
      lifetimeHours: new Map(lifetime.map((row) => [row.refCode, row._sum.hours ?? 0])),
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
    const { cost, complete } = costOf(rows, context.models, context.assumptions);

    let totalHours = 0;
    let billableHours = 0;
    let allocatedRevenue = 0;
    let revenueComplete = true;

    for (const row of rows) {
      totalHours += row.hours;
      const project = context.projects.get(row.refCode);

      if (isBillable(row.category, context.assumptions)) {
        billableHours += row.hours;
        // Only billable work is expected to carry a price; an internal category
        // without one is not a gap.
        if (!project || project.price === null || project.price <= 0) revenueComplete = false;
      }

      const allocated = allocate(
        project?.price ?? null,
        row.hours,
        context.lifetimeHours.get(row.refCode) ?? 0,
      );
      if (allocated !== null) allocatedRevenue += allocated;
    }

    const whole = complete && revenueComplete;

    return {
      totalHours,
      billableHours,
      cost,
      costComplete: complete,
      allocatedRevenue,
      // Withheld rather than shown as trustworthy when an input is missing.
      profit: whole ? allocatedRevenue - cost : null,
      margin: whole ? ratio(allocatedRevenue - cost, allocatedRevenue) : null,
    };
  }

  private reconcile(context: Context) {
    let knownSalaries = 0;
    let overhead = 0;
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

    const allocated = costOf(context.entries, context.models, context.assumptions).cost;
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
    return describePeriod(context.scope, context.entries);
  }
}

// ---- helpers ------------------------------------------------------------

function periodWhere(scope: Scope) {
  return { year: scope.year, ...(scope.month === null ? {} : { month: scope.month }) };
}

/** `monthsCovered` is the coverage signal: how many months actually hold rows. */
function describePeriod(scope: Scope, entries: Entry[]) {
  return {
    year: scope.year,
    month: scope.month,
    label: periodLabel(scope.year, scope.month),
    monthsCovered: new Set(entries.map((row) => monthKey(row.year, row.month))).size,
    hasData: entries.length > 0,
  };
}

function salesMonthOf(project: ProjectRecord | null) {
  if (!project || project.salesYear === null || project.salesMonth === null) return null;
  return {
    year: project.salesYear,
    month: project.salesMonth,
    label: monthLabel(project.salesYear, project.salesMonth),
  };
}

function allocate(price: number | null, hours: number, lifetimeHours: number): number | null {
  if (price === null || price <= 0 || lifetimeHours <= 0) return null;
  return price * (hours / lifetimeHours);
}

/**
 * A project with no price row still has a name in the timesheet's task column.
 * Falling back to it, then to the ref code, keeps an unpriced project visible.
 */
function displayName(project: ProjectRecord | null, rows: Entry[], refCode: string): string {
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
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return [...groups.entries()];
}

function sum<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}

/** Non-finite becomes null; margins are never clamped. */
function round2(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function round4(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 10000) / 10000;
}

/** For hours and other sums that are always finite. */
function hours2(value: number): number {
  return Math.round(value * 100) / 100;
}
