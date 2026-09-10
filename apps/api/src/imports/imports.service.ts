import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async importTimesheet(filename: string, buffer: Buffer, userId: number): Promise<ImportResult> {
    const parsed = await this.parse(() => parseTimesheet(buffer));
    this.rejectOnIssues(parsed.issues);

    const warnings = [...parsed.warnings, ...(await this.timesheetWarnings(parsed.rows))];

    const importId = await this.prisma.$transaction(async (tx) => {
      await upsertEmployees(tx, parsed.rows);

      for (const period of parsed.periods) {
        await tx.timesheetEntry.deleteMany({ where: { year: period.year, month: period.month } });
      }

      await tx.timesheetEntry.createMany({ data: parsed.rows });

      return recordImport(tx, 'timesheet', filename, userId, parsed.rows.length, parsed.periods, warnings);
    });

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

    const importId = await this.prisma.$transaction(async (tx) => {
      await upsertEmployees(tx, parsed.rows);

      // Scope comes from the month *columns*, not the values, so a column of
      // blanks clears that month instead of leaving stale figures behind.
      for (const period of parsed.periods) {
        await tx.salary.deleteMany({ where: { year: period.year, month: period.month } });
      }

      await tx.salary.createMany({
        data: parsed.rows.map(({ employeeNo, year: y, month, amount }) => ({
          employeeNo,
          year: y,
          month,
          amount,
        })),
      });

      return recordImport(tx, 'salaries', filename, userId, parsed.rows.length, parsed.periods, warnings);
    });

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
      (await this.prisma.project.findMany({ select: { refCode: true } })).map((row) => row.refCode),
    );
    const inserted = parsed.rows.filter((row) => !existing.has(row.refCode)).length;

    const importId = await this.prisma.$transaction(async (tx) => {
      // Upsert only. A catalogue upload that omits a project is far more likely
      // to be partial than to mean "delete it".
      for (const row of parsed.rows) {
        await tx.project.upsert({ where: { refCode: row.refCode }, create: row, update: row });
      }

      return recordImport(tx, 'projects', filename, userId, parsed.rows.length, [], parsed.warnings);
    });

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

  async history() {
    const rows = await this.prisma.import.findMany({
      orderBy: { id: 'desc' },
      include: { user: { select: { email: true } } },
    });

    const kinds = new Set(rows.map((row) => row.kind));

    return {
      imports: rows.map((row) => ({
        id: row.id,
        kind: row.kind as ImportKind,
        filename: row.filename,
        uploadedAt: row.uploadedAt,
        uploadedBy: row.user?.email ?? null,
        rowsAccepted: row.rowsAccepted,
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

  /** Unpriced billable ref codes, judged against the current billable categories. */
  private async timesheetWarnings(rows: TimesheetRow[]): Promise<ImportWarning[]> {
    const { billableCategories } = await this.settings.read();
    const billable = new Set(billableCategories.map((c) => c.toLowerCase()));
    const priced = new Set(
      (await this.prisma.project.findMany({ select: { refCode: true } })).map((row) => row.refCode),
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

/** The transaction-scoped client Prisma hands to `$transaction`. */
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

async function upsertEmployees(
  tx: Tx,
  rows: { employeeNo: string; employeeName: string }[],
): Promise<void> {
  const names = new Map(rows.map((row) => [row.employeeNo, row.employeeName]));
  for (const [employeeNo, name] of names) {
    await tx.employee.upsert({ where: { employeeNo }, create: { employeeNo, name }, update: { name } });
  }
}

async function recordImport(
  tx: Tx,
  kind: ImportKind,
  filename: string,
  userId: number,
  rowsAccepted: number,
  periods: Period[],
  warnings: ImportWarning[],
): Promise<number> {
  const row = await tx.import.create({
    data: {
      kind,
      filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      rowsAccepted,
      periods: JSON.stringify(periods.map(labelled)),
      warnings: JSON.stringify(warnings),
    },
    select: { id: true },
  });
  return row.id;
}

function labelled(period: Period) {
  return { year: period.year, month: period.month, label: monthLabel(period.year, period.month) };
}
