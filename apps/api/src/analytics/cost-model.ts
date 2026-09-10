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

  type Bucket = {
    year: number;
    month: number;
    /** Per employee, accumulated in one pass rather than re-scanned per person. */
    logged: Map<string, { total: number; billable: number; nonBillable: number }>;
    paid: Set<string>;
    billableHours: number;
  };

  const months = new Map<string, Bucket>();
  const bucketFor = (year: number, month: number): Bucket => {
    const key = monthKey(year, month);
    let bucket = months.get(key);
    if (!bucket) {
      bucket = { year, month, logged: new Map(), paid: new Set(), billableHours: 0 };
      months.set(key, bucket);
    }
    return bucket;
  };

  for (const entry of entries) {
    const bucket = bucketFor(entry.year, entry.month);
    const hours = bucket.logged.get(entry.employeeNo) ?? { total: 0, billable: 0, nonBillable: 0 };
    hours.total += entry.hours;

    if (isBillable(entry.category, assumptions)) {
      hours.billable += entry.hours;
      bucket.billableHours += entry.hours;
    } else {
      hours.nonBillable += entry.hours;
    }

    bucket.logged.set(entry.employeeNo, hours);
  }

  // A month can have salaries and no timesheet at all; it still has a pool.
  for (const salary of salaries) bucketFor(salary.year, salary.month).paid.add(salary.employeeNo);

  const models = new Map<string, MonthModel>();

  for (const [key, bucket] of months) {
    const directRates = new Map<string, number | null>();
    const missingSalaryEmployees: string[] = [];
    let pool = assumptions.monthlyOverhead;
    let knownSalaries = 0;
    let uncostedBillableHours = 0;

    for (const employeeNo of new Set([...bucket.logged.keys(), ...bucket.paid])) {
      const salary = salaryOf.get(`${key}|${employeeNo}`);
      const hours = bucket.logged.get(employeeNo) ?? { total: 0, billable: 0, nonBillable: 0 };

      if (salary === undefined) {
        // Unknown, not zero: no direct rate, so this person's rows cannot be
        // costed. Their billable hours still count in the indirect rate's
        // denominator below -- the assessment divides by all billable hours,
        // and shrinking that would make colleagues absorb the missing share.
        directRates.set(employeeNo, null);
        uncostedBillableHours += hours.billable;
        if (hours.total > 0) missingSalaryEmployees.push(employeeNo);
        continue;
      }

      knownSalaries += salary;

      if (hours.total === 0) {
        // Support staff: the whole salary is indirect.
        directRates.set(employeeNo, null);
        pool += salary;
        continue;
      }

      const rate = salary / hours.total;
      directRates.set(employeeNo, rate);

      // Direct rate only. Adding the indirect rate here would count the pool
      // inside itself and break the self-check.
      pool += hours.nonBillable * rate;
    }

    models.set(key, {
      year: bucket.year,
      month: bucket.month,
      directRates,
      indirectRate: bucket.billableHours > 0 ? pool / bucket.billableHours : null,
      pool,
      knownSalaries,
      overhead: assumptions.monthlyOverhead,
      billableHours: bucket.billableHours,
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

/**
 * Cost of a set of rows, and whether that figure is the whole story.
 *
 * The number is always the cost of the rows that could be costed -- never null,
 * so a single gap cannot blank a year. `complete` is what says whether anything
 * is missing from it, and callers withhold profit, margin and profitability
 * when it is false.
 *
 * A month with a missing salary has an understated indirect rate, so EVERY row
 * in it is priced too low -- including rows belonging to people whose own
 * salary is known. Completeness is therefore a property of the months a group
 * touches, not only of the group's own employees.
 */
export function costOf(
  rows: Entry[],
  models: Map<string, MonthModel>,
  assumptions: Assumptions,
): { cost: number; complete: boolean } {
  let cost = 0;
  let complete = true;

  for (const row of rows) {
    const model = models.get(monthKey(row.year, row.month));
    if (!model || !model.poolComplete) complete = false;
    if (!isBillable(row.category, assumptions)) continue;

    const value = entryCost(row, model);
    if (value === null) complete = false;
    else cost += value;
  }

  return { cost, complete };
}

export function ratio(numerator: number, denominator: number | null): number | null {
  if (denominator === null || denominator === 0 || !Number.isFinite(denominator)) return null;
  const value = numerator / denominator;
  // Margins are unbounded and often negative -- never clamped. Only genuinely
  // undefined values become null.
  return Number.isFinite(value) ? value : null;
}
