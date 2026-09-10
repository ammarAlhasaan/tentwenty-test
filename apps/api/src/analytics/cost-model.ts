/**
 * The assessment's cost model. No Nest, no SQL -- plain functions over plain
 * arrays, so the arithmetic can be read against the brief without tracing
 * through a framework.
 *
 *   direct cost rate / hour   = that month's salary / that month's logged hours
 *   indirect cost pool        = salaries of people who logged no hours
 *                             + everyone else's non-billable time at their direct rate
 *                             + monthly overhead
 *   indirect cost rate / hour = indirect cost pool / billable hours that month
 *   employee cost on a project= hours x (direct rate + indirect rate)
 *   employee revenue share    = price x (employee hours / total project hours)
 *   employee profitability    = (revenue share - employee cost) / revenue share
 *   project profitability     = (price - total project cost) / price
 *   productivity              = billable hours / total hours logged
 */

export type Entry = {
  year: number;
  month: number;
  employeeNo: string;
  employeeName: string;
  typeOfExpense: string | null;
  department: string;
  designation: string | null;
  category: string;
  refCode: string;
  taskName: string | null;
  companyName: string | null;
  hours: number;
};

export type SalaryRecord = { employeeNo: string; year: number; month: number; amount: number };

export type ProjectRecord = {
  refCode: string;
  name: string;
  price: number | null;
  salesYear: number | null;
  salesMonth: number | null;
  category: string | null;
  status: string | null;
};

export type Assumptions = { billableCategories: string[]; monthlyOverhead: number };

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function isBillable(category: string, assumptions: Assumptions): boolean {
  return assumptions.billableCategories.some(
    (name) => name.toLowerCase() === category.toLowerCase(),
  );
}

/** Rates and pool for one calendar month. */
export type MonthModel = {
  year: number;
  month: number;
  /** null where the employee's salary is unknown -- never 0, which is a real salary. */
  directRates: Map<string, number | null>;
  /**
   * pool / ALL billable hours that month -- the assessment's denominator,
   * unchanged. Narrowing it to employees with a known salary would make
   * colleagues absorb a missing person's share purely to force the
   * reconciliation to balance, which is a different cost model.
   */
  indirectRate: number | null;
  pool: number;
  knownSalaries: number;
  overhead: number;
  billableHours: number;
  /** Billable hours whose direct rate is unknown, so their cost cannot be computed. */
  uncostedBillableHours: number;
  /**
   * False when an employee logged hours in this month with no salary on record.
   * Their non-billable time is missing from the pool, so the indirect rate is
   * understated and EVERY project cost in this month is partial -- not just the
   * rows belonging to that person.
   */
  poolComplete: boolean;
  missingSalaryEmployees: string[];
};

export function buildMonthModels(
  entries: Entry[],
  salaries: SalaryRecord[],
  assumptions: Assumptions,
): Map<string, MonthModel> {
  const salaryOf = new Map(salaries.map((s) => [`${monthKey(s.year, s.month)}|${s.employeeNo}`, s.amount]));

  const months = new Map<string, { year: number; month: number; entries: Entry[] }>();
  for (const entry of entries) {
    const key = monthKey(entry.year, entry.month);
    const bucket = months.get(key) ?? { year: entry.year, month: entry.month, entries: [] };
    bucket.entries.push(entry);
    months.set(key, bucket);
  }
  // A month can have salaries and no timesheet at all; it still has a pool.
  for (const salary of salaries) {
    const key = monthKey(salary.year, salary.month);
    if (!months.has(key)) months.set(key, { year: salary.year, month: salary.month, entries: [] });
  }

  const models = new Map<string, MonthModel>();

  for (const [key, bucket] of months) {
    const loggedHours = new Map<string, number>();
    for (const entry of bucket.entries) {
      loggedHours.set(entry.employeeNo, (loggedHours.get(entry.employeeNo) ?? 0) + entry.hours);
    }

    const paidThisMonth = salaries.filter((s) => monthKey(s.year, s.month) === key);
    const people = new Set<string>([...loggedHours.keys(), ...paidThisMonth.map((s) => s.employeeNo)]);

    const directRates = new Map<string, number | null>();
    const missingSalaryEmployees: string[] = [];
    let pool = assumptions.monthlyOverhead;
    let knownSalaries = 0;

    for (const employeeNo of people) {
      const salary = salaryOf.get(`${key}|${employeeNo}`);
      const hours = loggedHours.get(employeeNo) ?? 0;

      if (salary === undefined) {
        // Unknown, not zero. Excluded from the model's denominators so the
        // reconciliation stays exact over what is known; flagged separately.
        directRates.set(employeeNo, null);
        if (hours > 0) missingSalaryEmployees.push(employeeNo);
        continue;
      }

      knownSalaries += salary;

      if (hours === 0) {
        // Support staff: the whole salary is indirect.
        directRates.set(employeeNo, null);
        pool += salary;
        continue;
      }

      const rate = salary / hours;
      directRates.set(employeeNo, rate);

      const nonBillable = bucket.entries
        .filter((e) => e.employeeNo === employeeNo && !isBillable(e.category, assumptions))
        .reduce((total, e) => total + e.hours, 0);

      // Direct rate only. Adding the indirect rate here would count the pool
      // inside itself and break the self-check.
      pool += nonBillable * rate;
    }

    let billableHours = 0;
    let uncostedBillableHours = 0;
    for (const entry of bucket.entries) {
      if (!isBillable(entry.category, assumptions)) continue;
      billableHours += entry.hours;
      // These hours still belong in the denominator; what is unknown is the
      // direct rate to add to the indirect one, not the hours themselves.
      if (directRates.get(entry.employeeNo) == null) uncostedBillableHours += entry.hours;
    }

    models.set(key, {
      year: bucket.year,
      month: bucket.month,
      directRates,
      indirectRate: billableHours > 0 ? pool / billableHours : null,
      pool,
      knownSalaries,
      overhead: assumptions.monthlyOverhead,
      billableHours,
      uncostedBillableHours,
      poolComplete: missingSalaryEmployees.length === 0,
      missingSalaryEmployees: [...new Set(missingSalaryEmployees)],
    });
  }

  return models;
}

/** Cost of one billable timesheet row, or null when the rate is unknown. */
export function entryCost(entry: Entry, model: MonthModel | undefined): number | null {
  if (!model) return null;
  const direct = model.directRates.get(entry.employeeNo);
  if (direct === null || direct === undefined) return null;
  if (model.indirectRate === null) return null;
  return entry.hours * (direct + model.indirectRate);
}

/**
 * The share of the indirect pool that landed on billable hours whose direct
 * rate is unknown. Those rows have no employee cost, so this much of the pool
 * is real but attributable to nobody -- reported rather than absorbed by the
 * employees whose salaries happen to be on record.
 */
export function uncostedIndirect(model: MonthModel): number {
  if (model.indirectRate === null) return 0;
  return model.indirectRate * model.uncostedBillableHours;
}

/** Salary cost of any row, billable or not -- what the time cost to employ. */
export function entryDirectCost(entry: Entry, model: MonthModel | undefined): number | null {
  const direct = model?.directRates.get(entry.employeeNo);
  if (direct === null || direct === undefined) return null;
  return entry.hours * direct;
}

export function ratio(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator === 0 || !Number.isFinite(denominator)) return null;
  const value = numerator / denominator;
  // Margins are unbounded and often negative -- never clamped. Only genuinely
  // undefined values become null.
  return Number.isFinite(value) ? value : null;
}
