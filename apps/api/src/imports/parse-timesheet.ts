import { monthKey } from '../analytics/cost-model.js';
import {
  type CellValue,
  type ImportIssue,
  type ImportWarning,
  type Period,
  cellNumber,
  cellText,
  columnIndex,
  findHeaderRow,
  isBlankRow,
  parseMonth,
  rawCell,
  readRows,
  spreadsheetRow,
} from './parse-workbook.js';

export type TimesheetRow = {
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
  description: string | null;
  hours: number;
};

type TimesheetParseResult = {
  rows: TimesheetRow[];
  periods: Period[];
  warnings: ImportWarning[];
  issues: ImportIssue[];
  rowsSkipped: number;
};

const REQUIRED = [
  'Month',
  'Employee No.',
  'Employee Name',
  'Department',
  'Category',
  'Ref Code',
  'Hours',
];

export async function parseTimesheet(buffer: Buffer): Promise<TimesheetParseResult> {
  const sheet = await readRows(buffer);
  const header = findHeaderRow(sheet, REQUIRED);

  const at = {
    month: columnIndex(header, 'Month')!,
    employeeNo: columnIndex(header, 'Employee No.')!,
    employeeName: columnIndex(header, 'Employee Name')!,
    department: columnIndex(header, 'Department')!,
    category: columnIndex(header, 'Category')!,
    refCode: columnIndex(header, 'Ref Code')!,
    hours: columnIndex(header, 'Hours')!,
    typeOfExpense: columnIndex(header, 'Type of Expense'),
    designation: columnIndex(header, 'Designation'),
    taskName: columnIndex(header, 'Project (Billable) / Task (Unbillable) Name'),
    companyName: columnIndex(header, 'Company Name (Billable)/ Fixed Costs (Unbillable)'),
    description: columnIndex(header, 'Description'),
  };

  const rows: TimesheetRow[] = [];
  const issues: ImportIssue[] = [];
  const periods = new Map<string, Period>();
  let rowsSkipped = 0;

  for (let i = header.rowIndex + 1; i < sheet.length; i += 1) {
    const raw = sheet[i] ?? [];
    if (isBlankRow(raw)) {
      rowsSkipped += 1;
      continue;
    }

    const line = spreadsheetRow(i);
    const pick = (index: number | null): CellValue => (index === null ? null : (raw[index] ?? null));

    const period = parseMonth(pick(at.month));
    if (!period) {
      issues.push({
        row: line,
        message: `Month "${rawCell(pick(at.month))}" was not recognised.`,
      });
      continue;
    }

    const employeeNo = cellText(pick(at.employeeNo));
    if (employeeNo === null) {
      issues.push({ row: line, message: 'Employee No. is required.' });
      continue;
    }

    const department = cellText(pick(at.department));
    const category = cellText(pick(at.category));
    const refCode = cellText(pick(at.refCode));
    const missing = [
      department === null ? 'Department' : null,
      category === null ? 'Category' : null,
      refCode === null ? 'Ref Code' : null,
    ].filter((name): name is string => name !== null);

    if (missing.length > 0) {
      issues.push({ row: line, message: `${missing.join(' and ')} is required.` });
      continue;
    }

    const hours = cellNumber(pick(at.hours));
    if (hours === null || hours === 'invalid') {
      issues.push({
        row: line,
        message: `Hours must be a number, found "${rawCell(pick(at.hours))}".`,
      });
      continue;
    }
    if (hours < 0) {
      issues.push({ row: line, message: `Hours must not be negative, found ${hours}.` });
      continue;
    }

    // Stored exactly as supplied. Rows are never merged: two rows that look
    // alike can differ in a dimension a drilldown needs, and identical rows are
    // normally two real entries of work. Repeat uploads are made idempotent by
    // replacing the whole period instead.
    rows.push({
      year: period.year,
      month: period.month,
      employeeNo,
      employeeName: cellText(pick(at.employeeName)) ?? employeeNo,
      typeOfExpense: cellText(pick(at.typeOfExpense)),
      department: department!,
      designation: cellText(pick(at.designation)),
      category: category!,
      refCode: refCode!,
      taskName: cellText(pick(at.taskName)),
      companyName: cellText(pick(at.companyName)),
      description: cellText(pick(at.description)),
      hours,
    });

    periods.set(monthKey(period.year, period.month), period);
  }

  return {
    rows,
    periods: [...periods.values()].sort(byPeriod),
    warnings: [],
    issues,
    rowsSkipped,
  };
}

export function byPeriod(a: Period, b: Period): number {
  return a.year - b.year || a.month - b.month;
}
