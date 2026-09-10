import { monthKey } from '../analytics/cost-model.js';
import {
  type CellValue,
  type ImportIssue,
  type ImportWarning,
  type Period,
  WorkbookError,
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
import { byPeriod } from './parse-timesheet.js';

type SalaryRow = { employeeNo: string; employeeName: string } & Period & { amount: number };

type SalaryParseResult = {
  rows: SalaryRow[];
  /**
   * Every month **column** in the header, whether or not its cells hold values.
   * This is the import's replacement scope, so a column of blanks clears that
   * month rather than leaving stale figures behind.
   */
  periods: Period[];
  warnings: ImportWarning[];
  issues: ImportIssue[];
  rowsSkipped: number;
};

const REQUIRED = ['Employee No.', 'Employee Name'];

export async function parseSalaries(
  buffer: Buffer,
  yearFromRequest?: number | null,
): Promise<SalaryParseResult> {
  const sheet = await readRows(buffer);
  const header = findHeaderRow(sheet, REQUIRED);
  const headerRow = sheet[header.rowIndex] ?? [];

  const employeeNoAt = columnIndex(header, 'Employee No.')!;
  const employeeNameAt = columnIndex(header, 'Employee Name')!;

  // A year stated in a month column wins; otherwise the title rows above the
  // header ("Salary Overview 2025 (AED)"); otherwise the uploader must say.
  const fallbackYear = yearFromTitle(sheet, header.rowIndex) ?? yearFromRequest ?? null;

  const monthColumns: { index: number; period: Period }[] = [];
  headerRow.forEach((cell, index) => {
    if (index === employeeNoAt || index === employeeNameAt) return;
    const period = parseMonth(cell, fallbackYear);
    if (period) monthColumns.push({ index, period });
  });

  if (monthColumns.length === 0) {
    const bare = headerRow.some((cell) => parseMonth(cell, 2000) !== null);
    throw new WorkbookError(
      bare
        ? 'The workbook uses bare month names and states no year. Send a year with the upload.'
        : 'No month columns were found. Expected columns such as January, February, ... December.',
    );
  }

  const rows: SalaryRow[] = [];
  const issues: ImportIssue[] = [];
  let rowsSkipped = 0;

  for (let i = header.rowIndex + 1; i < sheet.length; i += 1) {
    const raw = sheet[i] ?? [];
    if (isBlankRow(raw)) {
      rowsSkipped += 1;
      continue;
    }

    const line = spreadsheetRow(i);
    const employeeNo = cellText(raw[employeeNoAt] ?? null);
    if (employeeNo === null) {
      issues.push({ row: line, message: 'Employee No. is required.' });
      continue;
    }
    const employeeName = cellText(raw[employeeNameAt] ?? null) ?? employeeNo;

    for (const column of monthColumns) {
      const cell: CellValue = raw[column.index] ?? null;
      const amount = cellNumber(cell);

      // A blank cell is skipped, never stored as 0: absence of a row is how
      // "unknown" is represented, and 0 is a genuine zero salary.
      if (amount === null) continue;

      if (amount === 'invalid') {
        issues.push({
          row: line,
          message: `Salary for ${monthKey(column.period.year, column.period.month)} must be a number, found "${rawCell(cell)}".`,
        });
        continue;
      }
      if (amount < 0) {
        issues.push({
          row: line,
          message: `Salary for ${monthKey(column.period.year, column.period.month)} must not be negative, found ${amount}.`,
        });
        continue;
      }

      rows.push({ employeeNo, employeeName, ...column.period, amount });
    }
  }

  return {
    rows,
    periods: monthColumns.map((column) => column.period).sort(byPeriod),
    warnings: [],
    issues,
    rowsSkipped,
  };
}

function yearFromTitle(sheet: CellValue[][], headerRowIndex: number): number | null {
  for (let i = 0; i < headerRowIndex; i += 1) {
    for (const cell of sheet[i] ?? []) {
      const match = /\b(19|20)\d{2}\b/.exec(cellText(cell) ?? '');
      if (match) return Number(match[0]);
    }
  }
  return null;
}
