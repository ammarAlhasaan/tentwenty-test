import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  type ImportIssue,
  type ImportWarning,
  type Period,
  WorkbookError,
  monthLabel,
} from './parse-workbook.js';
import { parseProjects } from './parse-projects.js';
import { parseSalaries } from './parse-salaries.js';
import { type TimesheetRow, parseTimesheet } from './parse-timesheet.js';

const MAX_REPORTED_ISSUES = 50;

export type ImportKind = 'timesheet' | 'salaries' | 'projects';

export type ImportResult = {
  importId: number;
  kind: ImportKind;
  filename: string;
  rowsAccepted: number;
  rowsSkipped: number;
  periodsReplaced: { year: number; month: number; label: string }[];
  projectsInserted?: number;
  projectsUpdated?: number;
  warnings: ImportWarning[];
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
  ) {}

  async importTimesheet(filename: string, buffer: Buffer, userId: number): Promise<ImportResult> {
    const parsed = await this.parse(() => parseTimesheet(buffer));
    this.rejectOnIssues(parsed.issues);

    const warnings = [...parsed.warnings, ...this.timesheetWarnings(parsed.rows)];

    const importId = this.database.db.transaction(() => {
      this.upsertEmployees(parsed.rows.map((row) => [row.employeeNo, row.employeeName]));

      const remove = this.database.db.prepare(
        'DELETE FROM timesheet_entries WHERE year = ? AND month = ?',
      );
      for (const period of parsed.periods) remove.run(period.year, period.month);

      const insert = this.database.db.prepare(
        `INSERT INTO timesheet_entries
           (year, month, employee_no, employee_name, type_of_expense, department, designation,
            category, ref_code, task_name, company_name, description, hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const row of parsed.rows) {
        insert.run(
          row.year,
          row.month,
          row.employeeNo,
          row.employeeName,
          row.typeOfExpense,
          row.department,
          row.designation,
          row.category,
          row.refCode,
          row.taskName,
          row.companyName,
          row.description,
          row.hours,
        );
      }

      return this.recordImport('timesheet', filename, userId, parsed.rows.length, parsed.periods, warnings);
    })();

    return {
      importId,
      kind: 'timesheet',
      filename,
      rowsAccepted: parsed.rows.length,
      rowsSkipped: parsed.rowsSkipped,
      periodsReplaced: parsed.periods.map(labelled),
      warnings,
    };
  }

  async importSalaries(
    filename: string,
    buffer: Buffer,
    userId: number,
    year?: number | null,
  ): Promise<ImportResult> {
    const parsed = await this.parse(() => parseSalaries(buffer, year));
    this.rejectOnIssues(parsed.issues);

    const warnings = parsed.warnings;

    const importId = this.database.db.transaction(() => {
      this.upsertEmployees(parsed.rows.map((row) => [row.employeeNo, row.employeeName]));

      // Scope comes from the month *columns*, not the values, so a column of
      // blanks clears that month instead of leaving stale figures behind.
      const remove = this.database.db.prepare('DELETE FROM salaries WHERE year = ? AND month = ?');
      for (const period of parsed.periods) remove.run(period.year, period.month);

      const insert = this.database.db.prepare(
        'INSERT INTO salaries (employee_no, year, month, amount) VALUES (?, ?, ?, ?)',
      );
      for (const row of parsed.rows) {
        insert.run(row.employeeNo, row.year, row.month, row.amount);
      }

      return this.recordImport('salaries', filename, userId, parsed.rows.length, parsed.periods, warnings);
    })();

    return {
      importId,
      kind: 'salaries',
      filename,
      rowsAccepted: parsed.rows.length,
      rowsSkipped: parsed.rowsSkipped,
      periodsReplaced: parsed.periods.map(labelled),
      warnings,
    };
  }

  async importProjects(filename: string, buffer: Buffer, userId: number): Promise<ImportResult> {
    const parsed = await this.parse(() => parseProjects(buffer));
    this.rejectOnIssues(parsed.issues);

    const existing = new Set(
      (this.database.db.prepare('SELECT ref_code FROM projects').all() as { ref_code: string }[]).map(
        (row) => row.ref_code,
      ),
    );
    const inserted = parsed.rows.filter((row) => !existing.has(row.refCode)).length;

    const importId = this.database.db.transaction(() => {
      // Upsert only. A catalogue upload that omits a project is far more likely
      // to be partial than to mean "delete it".
      const upsert = this.database.db.prepare(
        `INSERT INTO projects (ref_code, name, price, sales_year, sales_month, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(ref_code) DO UPDATE SET
           name = excluded.name, price = excluded.price, sales_year = excluded.sales_year,
           sales_month = excluded.sales_month, category = excluded.category, status = excluded.status`,
      );
      for (const row of parsed.rows) {
        upsert.run(
          row.refCode,
          row.name,
          row.price,
          row.salesYear,
          row.salesMonth,
          row.category,
          row.status,
        );
      }

      return this.recordImport('projects', filename, userId, parsed.rows.length, [], parsed.warnings);
    })();

    return {
      importId,
      kind: 'projects',
      filename,
      rowsAccepted: parsed.rows.length,
      rowsSkipped: parsed.rowsSkipped,
      periodsReplaced: [],
      projectsInserted: inserted,
      projectsUpdated: parsed.rows.length - inserted,
      warnings: parsed.warnings,
    };
  }

  history() {
    const rows = this.database.db
      .prepare(
        `SELECT i.id, i.kind, i.filename, i.uploaded_at, i.rows_accepted, i.periods, i.warnings,
                u.email AS uploaded_by
         FROM imports i LEFT JOIN users u ON u.id = i.uploaded_by
         ORDER BY i.id DESC`,
      )
      .all() as {
      id: number;
      kind: ImportKind;
      filename: string;
      uploaded_at: string;
      rows_accepted: number;
      periods: string;
      warnings: string;
      uploaded_by: string | null;
    }[];

    const kinds = new Set(rows.map((row) => row.kind));

    return {
      imports: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        filename: row.filename,
        uploadedAt: row.uploaded_at,
        uploadedBy: row.uploaded_by,
        rowsAccepted: row.rows_accepted,
        periodsReplaced: JSON.parse(row.periods) as Period[],
        warningCount: (JSON.parse(row.warnings) as ImportWarning[]).length,
      })),
      loaded: {
        timesheet: kinds.has('timesheet'),
        salaries: kinds.has('salaries'),
        projects: kinds.has('projects'),
      },
    };
  }

  /** Parsing happens outside every transaction, so a bad file never opens one. */
  private async parse<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof WorkbookError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  private rejectOnIssues(issues: ImportIssue[]): void {
    if (issues.length === 0) return;

    const shown = issues
      .slice(0, MAX_REPORTED_ISSUES)
      .map((issue) => `Row ${issue.row}: ${issue.message}`);

    throw new UnprocessableEntityException([
      `${issues.length} row${issues.length === 1 ? '' : 's'} could not be read; no data was changed.`,
      ...shown,
      ...(issues.length > shown.length ? [`... and ${issues.length - shown.length} more.`] : []),
    ]);
  }

  private upsertEmployees(pairs: [string, string][]): void {
    const upsert = this.database.db.prepare(
      'INSERT INTO employees (employee_no, name) VALUES (?, ?) ON CONFLICT(employee_no) DO UPDATE SET name = excluded.name',
    );
    const seen = new Set<string>();
    for (const [employeeNo, name] of pairs) {
      if (seen.has(employeeNo)) continue;
      seen.add(employeeNo);
      upsert.run(employeeNo, name);
    }
  }

  private recordImport(
    kind: ImportKind,
    filename: string,
    userId: number,
    rowsAccepted: number,
    periods: Period[],
    warnings: ImportWarning[],
  ): number {
    const result = this.database.db
      .prepare(
        `INSERT INTO imports (kind, filename, uploaded_at, uploaded_by, rows_accepted, periods, warnings)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        kind,
        filename,
        new Date().toISOString(),
        userId,
        rowsAccepted,
        JSON.stringify(periods.map(labelled)),
        JSON.stringify(warnings),
      );
    return Number(result.lastInsertRowid);
  }

  /** Unpriced billable ref codes, judged against the current billable categories. */
  private timesheetWarnings(rows: TimesheetRow[]): ImportWarning[] {
    const billable = new Set(this.settings.read().billableCategories.map((c) => c.toLowerCase()));
    const priced = new Set(
      (this.database.db.prepare('SELECT ref_code FROM projects').all() as { ref_code: string }[]).map(
        (row) => row.ref_code,
      ),
    );

    const unpriced = new Map<string, number>();
    for (const row of rows) {
      if (!billable.has(row.category.toLowerCase()) || priced.has(row.refCode)) continue;
      unpriced.set(row.refCode, (unpriced.get(row.refCode) ?? 0) + row.hours);
    }

    return [...unpriced].map(([refCode, hours]) => ({
      code: 'project_without_price',
      message: `Ref code ${refCode} has ${hours.toFixed(2)} billable hours and no price on record.`,
      context: { refCode, hours },
    }));
  }

}

function labelled(period: Period) {
  return { year: period.year, month: period.month, label: monthLabel(period.year, period.month) };
}
