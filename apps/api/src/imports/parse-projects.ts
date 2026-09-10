import {
  type ImportIssue,
  type ImportWarning,
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

type ProjectRow = {
  refCode: string;
  name: string;
  price: number | null;
  salesYear: number | null;
  salesMonth: number | null;
  category: string | null;
  status: string | null;
};

type ProjectParseResult = {
  rows: ProjectRow[];
  warnings: ImportWarning[];
  issues: ImportIssue[];
  rowsSkipped: number;
};

const REQUIRED = ['Ref Code', 'Project (Billable) Name', 'Project Price'];

export async function parseProjects(buffer: Buffer): Promise<ProjectParseResult> {
  const sheet = await readRows(buffer);
  const header = findHeaderRow(sheet, REQUIRED);

  const at = {
    refCode: columnIndex(header, 'Ref Code')!,
    name: columnIndex(header, 'Project (Billable) Name')!,
    price: columnIndex(header, 'Project Price')!,
    salesMonth: columnIndex(header, 'Sales month'),
    category: columnIndex(header, 'Category'),
    status: columnIndex(header, 'Status'),
  };

  const rows: ProjectRow[] = [];
  const issues: ImportIssue[] = [];
  const warnings: ImportWarning[] = [];
  const seen = new Set<string>();
  let rowsSkipped = 0;

  for (let i = header.rowIndex + 1; i < sheet.length; i += 1) {
    const raw = sheet[i] ?? [];
    if (isBlankRow(raw)) {
      rowsSkipped += 1;
      continue;
    }

    const line = spreadsheetRow(i);
    const refCode = cellText(raw[at.refCode] ?? null);
    if (refCode === null) {
      issues.push({ row: line, message: 'Ref Code is required.' });
      continue;
    }
    if (seen.has(refCode)) {
      issues.push({ row: line, message: `Ref Code ${refCode} appears more than once in this file.` });
      continue;
    }
    seen.add(refCode);

    const price = cellNumber(raw[at.price] ?? null);
    if (price === 'invalid') {
      issues.push({
        row: line,
        message: `Project Price must be a number, found "${rawCell(raw[at.price] ?? null)}".`,
      });
      continue;
    }

    // A missing or non-positive price is loaded and flagged, not rejected: the
    // project's hours still cost something, and only its revenue is unknown.
    if (price === null || price <= 0) {
      warnings.push({
        code: 'price_not_positive',
        message:
          price === null
            ? `${refCode} has no price. Its revenue and margin will be reported as unknown.`
            : `${refCode} has a price of ${price}. Its margin will be reported as unknown.`,
        context: { refCode },
      });
    }

    let salesYear: number | null = null;
    let salesMonth: number | null = null;
    const salesCell = at.salesMonth === null ? null : (raw[at.salesMonth] ?? null);
    if (cellText(salesCell) !== null) {
      const period = parseMonth(salesCell);
      if (!period) {
        issues.push({
          row: line,
          message: `Sales month "${rawCell(salesCell)}" was not recognised.`,
        });
        continue;
      }
      salesYear = period.year;
      salesMonth = period.month;
    }

    rows.push({
      refCode,
      name: cellText(raw[at.name] ?? null) ?? refCode,
      price: price === null ? null : price,
      salesYear,
      salesMonth,
      category: at.category === null ? null : cellText(raw[at.category] ?? null),
      status: at.status === null ? null : cellText(raw[at.status] ?? null),
    });
  }

  return { rows, warnings, issues, rowsSkipped };
}
