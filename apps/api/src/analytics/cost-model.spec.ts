/**
 * The assessment's cost model, checked against the assessment's own arithmetic.
 *
 * Every expected figure here was derived by hand from the formulas in the brief
 * (the derivations are written out in specs/009-cost-model-tests/data-model.md),
 * never copied from what the code currently returns. A test whose expectation
 * came from the code proves only that the code still agrees with itself.
 *
 * `null` means "unknown" and `0` means "zero". They are asserted with
 * `toBeNull()` and never with `toBeFalsy()`, which would accept either and
 * defeat the distinction that keeps a missing salary from rendering as AED 0.
 */

import { describe, expect, it } from 'vitest';
import {
  type Assumptions,
  type Entry,
  type SalaryRecord,
  buildMonthModels,
  costOf,
  entryCost,
  isBillable,
  ratio,
  uncostedIndirect,
} from './cost-model.js';

const YEAR = 2025;
const BILLABLE = 'Projects';
const INTERNAL = 'FC - Meetings';

/** Only the fields a case actually varies are arguments; the rest is filler the type demands. */
function entry(employeeNo: string, category: string, hours: number, month = 1): Entry {
  return {
    year: YEAR,
    month,
    employeeNo,
    employeeName: employeeNo,
    typeOfExpense: null,
    department: 'Design',
    designation: null,
    category,
    refCode: 'REF-1',
    taskName: null,
    companyName: null,
    hours,
  };
}

function salary(employeeNo: string, amount: number, month = 1): SalaryRecord {
  return { employeeNo, year: YEAR, month, amount };
}

const NO_OVERHEAD: Assumptions = { billableCategories: [BILLABLE], monthlyOverhead: 0 };

/**
 * Fixture A -- one month holding all three kinds of time the model distinguishes.
 *
 *   E1  18,000  160 h = 100 billable + 60 internal   direct rate 18000/160 = 112.50
 *   E2  12,000  100 h = 100 billable                 direct rate 12000/100 = 120.00
 *   E3  20,000    0 h  support staff                 no direct rate
 *
 * E2 is fully billable on purpose, which leaves E1 as the only person whose
 * total and billable hours differ -- that is what makes the direct-rate case
 * below able to tell the two denominators apart.
 */
const FIXTURE_A_ENTRIES: Entry[] = [
  entry('E1', BILLABLE, 100),
  entry('E1', INTERNAL, 60),
  entry('E2', BILLABLE, 100),
];

const FIXTURE_A_SALARIES: SalaryRecord[] = [
  salary('E1', 18_000),
  salary('E2', 12_000),
  salary('E3', 20_000),
];

const FIXTURE_A_TOTAL_SALARIES = 50_000;

describe('the reconciliation the assessment asks us to self-check', () => {
  it('costs a month to exactly its salary bill when overhead is zero', () => {
    const models = buildMonthModels(FIXTURE_A_ENTRIES, FIXTURE_A_SALARIES, NO_OVERHEAD);
    const { cost } = costOf(FIXTURE_A_ENTRIES, models, NO_OVERHEAD);

    // 100 x (112.50 + 133.75) + 100 x (120.00 + 133.75) = 24,625 + 25,375
    expect(cost).toBeCloseTo(50_000, 2);
    expect(cost).toBeCloseTo(FIXTURE_A_TOTAL_SALARIES, 2);
  });

  it('holds across two months whose salaries and hours both change', () => {
    // February pays more for fewer hours, so its rates are unlike January's --
    // and deliberately non-terminating (18500/120, 12500/150), which is why the
    // comparison carries the same 0.005 tolerance the service itself uses.
    const entries = [
      ...FIXTURE_A_ENTRIES,
      entry('E1', BILLABLE, 80, 2),
      entry('E1', INTERNAL, 40, 2),
      entry('E2', BILLABLE, 150, 2),
    ];
    const salaries = [
      ...FIXTURE_A_SALARIES,
      salary('E1', 18_500, 2),
      salary('E2', 12_500, 2),
      salary('E3', 20_500, 2),
    ];

    const { cost } = costOf(entries, buildMonthModels(entries, salaries, NO_OVERHEAD), NO_OVERHEAD);

    // 50,000 (January) + 51,500 (February). A blended rate across the two months
    // could not land here, because both the salaries and the hours moved.
    expect(cost).toBeCloseTo(101_500, 2);
  });

  it('adds the monthly overhead once for the month, not once per person', () => {
    const withOverhead: Assumptions = { billableCategories: [BILLABLE], monthlyOverhead: 12_000 };
    const models = buildMonthModels(FIXTURE_A_ENTRIES, FIXTURE_A_SALARIES, withOverhead);

    const { cost } = costOf(FIXTURE_A_ENTRIES, models, withOverhead);

    // Charging the overhead per employee, or per row, would give 74,000 here --
    // which is why the fixture carries three people and three rows.
    expect(cost).toBeCloseTo(FIXTURE_A_TOTAL_SALARIES + 12_000, 2);
  });
});

describe('the rates the brief defines', () => {
  it('divides a salary by total logged hours, not by billable hours', () => {
    const models = buildMonthModels(FIXTURE_A_ENTRIES, FIXTURE_A_SALARIES, NO_OVERHEAD);

    // 18000 / 160. Dividing by E1's 100 billable hours would give 180.
    expect(models.get('2025-01')?.directRates.get('E1')).toBe(112.5);
  });

  it('builds the indirect pool from support salaries, internal time and overhead', () => {
    const model = buildMonthModels(FIXTURE_A_ENTRIES, FIXTURE_A_SALARIES, NO_OVERHEAD).get('2025-01');

    const supportSalary = 20_000; // E3, who logged nothing
    const internalTime = 60 * 112.5; // E1's 60 internal hours at his own direct rate
    expect(model?.pool).toBeCloseTo(supportSalary + internalTime + 0, 2);
    expect(model?.pool).toBeCloseTo(26_750, 2);

    expect(model?.billableHours).toBe(200);
    expect(model?.indirectRate).toBeCloseTo(26_750 / 200, 2);
    expect(model?.indirectRate).toBeCloseTo(133.75, 2);
  });

  it('matches billable categories regardless of letter case', () => {
    // The real default set, from settings.schema.ts.
    const defaults: Assumptions = {
      billableCategories: ['Projects', 'Enhancements', 'Hosting'],
      monthlyOverhead: 0,
    };

    expect(isBillable('Projects', defaults)).toBe(true);
    expect(isBillable('projects', defaults)).toBe(true);
    expect(isBillable('HOSTING', defaults)).toBe(true);
    expect(isBillable('FC - Meetings', defaults)).toBe(false);
    expect(isBillable('FC - Idle', defaults)).toBe(false);
  });

  it('reports an unusable ratio as unknown and leaves a loss negative', () => {
    expect(ratio(50, 200)).toBe(0.25);

    expect(ratio(50, 0)).toBeNull();
    expect(ratio(50, null)).toBeNull();

    // A margin is unbounded: a loss stays a loss rather than being clamped at 0,
    // and a genuine zero stays 0 rather than collapsing into "unknown".
    expect(ratio(-100, 200)).toBe(-0.5);
    expect(ratio(0, 200)).toBe(0);
  });
});

describe('the gaps the brief warns us to expect', () => {
  it('keeps a missing salary unknown, flags the figure partial, and still balances', () => {
    // E4 logged 50 billable hours and has no salary row at all.
    const entries = [
      entry('E1', BILLABLE, 100),
      entry('E1', INTERNAL, 60),
      entry('E4', BILLABLE, 50),
    ];
    const salaries = [salary('E1', 18_000), salary('E3', 20_000)];

    const models = buildMonthModels(entries, salaries, NO_OVERHEAD);
    const model = models.get('2025-01')!;

    expect(model.directRates.get('E4')).toBeNull();
    expect(model.poolComplete).toBe(false);
    expect(model.missingSalaryEmployees).toContain('E4');

    // A number with a flag, never null: one gap must not blank the period.
    const { cost, complete } = costOf(entries, models, NO_OVERHEAD);
    expect(complete).toBe(false);
    expect(cost).toBeCloseTo(29_083.33, 2);

    // E4's 50 hours stay in the billable denominator on purpose. Removing them
    // would make E1 absorb a missing colleague's share of the pool just to force
    // the books to balance -- a different cost model from the one specified. The
    // share is reported instead, and the two parts still sum to the salary bill.
    expect(cost + uncostedIndirect(model)).toBeCloseTo(18_000 + 20_000, 2);
  });

  it('leaves a month with no billable hours unallocated rather than dividing by zero', () => {
    const entries = [entry('E1', INTERNAL, 160)];
    const salaries = [salary('E1', 18_000), salary('E3', 20_000)];

    const models = buildMonthModels(entries, salaries, NO_OVERHEAD);
    const model = models.get('2025-01')!;

    expect(model.billableHours).toBe(0);
    expect(model.indirectRate).toBeNull();
    expect(entryCost(entries[0], model)).toBeNull();

    // The cost is real, it simply has no billable hour to land on:
    // 20,000 support salary + 160 h x 112.50 of internal time.
    expect(model.pool).toBeCloseTo(38_000, 2);
  });
});
