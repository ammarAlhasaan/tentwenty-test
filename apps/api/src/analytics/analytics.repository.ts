import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Entry, ProjectRecord, SalaryRecord } from './cost-model.js';

/**
 * Every read is a single flat query for the whole period -- the cost model needs
 * month-wide aggregates before it can value any one row, so there is no row-at-a
 * -time read anywhere.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly database: DatabaseService) {}

  entries(year: number, month: number | null): Entry[] {
    return this.database.db
      .prepare(
        `SELECT year, month, employee_no AS employeeNo, employee_name AS employeeName,
                type_of_expense AS typeOfExpense, department, designation, category,
                ref_code AS refCode, company_name AS companyName, hours
         FROM timesheet_entries
         WHERE year = ? AND (? IS NULL OR month = ?)`,
      )
      .all(year, month, month) as Entry[];
  }

  entriesForRefCode(refCode: string): Entry[] {
    return this.database.db
      .prepare(
        `SELECT year, month, employee_no AS employeeNo, employee_name AS employeeName,
                type_of_expense AS typeOfExpense, department, designation, category,
                ref_code AS refCode, company_name AS companyName, hours
         FROM timesheet_entries WHERE ref_code = ?`,
      )
      .all(refCode) as Entry[];
  }

  /** Timesheet rows for whole months, needed to price a project's own months. */
  entriesForMonths(months: { year: number; month: number }[]): Entry[] {
    if (months.length === 0) return [];
    const where = months.map(() => '(year = ? AND month = ?)').join(' OR ');
    return this.database.db
      .prepare(
        `SELECT year, month, employee_no AS employeeNo, employee_name AS employeeName,
                type_of_expense AS typeOfExpense, department, designation, category,
                ref_code AS refCode, company_name AS companyName, hours
         FROM timesheet_entries WHERE ${where}`,
      )
      .all(...months.flatMap((m) => [m.year, m.month])) as Entry[];
  }

  salaries(year: number, month: number | null): SalaryRecord[] {
    return this.database.db
      .prepare(
        `SELECT employee_no AS employeeNo, year, month, amount
         FROM salaries WHERE year = ? AND (? IS NULL OR month = ?)`,
      )
      .all(year, month, month) as SalaryRecord[];
  }

  salariesForMonths(months: { year: number; month: number }[]): SalaryRecord[] {
    if (months.length === 0) return [];
    const where = months.map(() => '(year = ? AND month = ?)').join(' OR ');
    return this.database.db
      .prepare(
        `SELECT employee_no AS employeeNo, year, month, amount FROM salaries WHERE ${where}`,
      )
      .all(...months.flatMap((m) => [m.year, m.month])) as SalaryRecord[];
  }

  projects(): ProjectRecord[] {
    return this.database.db
      .prepare(
        `SELECT ref_code AS refCode, name, price, sales_year AS salesYear,
                sales_month AS salesMonth, category, status
         FROM projects`,
      )
      .all() as ProjectRecord[];
  }

  /**
   * Hours per project across EVERY loaded period. This is the denominator for
   * revenue allocation and must never be narrowed by the requested period --
   * doing so would credit each period with the project's entire price.
   */
  lifetimeHoursByRefCode(): Map<string, number> {
    const rows = this.database.db
      .prepare('SELECT ref_code AS refCode, SUM(hours) AS hours FROM timesheet_entries GROUP BY ref_code')
      .all() as { refCode: string; hours: number }[];
    return new Map(rows.map((row) => [row.refCode, row.hours]));
  }

  availablePeriods(): { year: number; month: number; hasTimesheet: number; hasSalaries: number }[] {
    return this.database.db
      .prepare(
        `SELECT year, month, MAX(t) AS hasTimesheet, MAX(s) AS hasSalaries FROM (
           SELECT year, month, 1 AS t, 0 AS s FROM timesheet_entries
           UNION ALL
           SELECT year, month, 0 AS t, 1 AS s FROM salaries
         ) GROUP BY year, month ORDER BY year, month`,
      )
      .all() as { year: number; month: number; hasTimesheet: number; hasSalaries: number }[];
  }
}
