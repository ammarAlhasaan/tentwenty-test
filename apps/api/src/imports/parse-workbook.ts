// read-excel-file v9's *default* export returns Sheet[] ({ sheet, data }), not
// rows -- a shape that type-checks as an array and then fails at runtime. The
// named `readSheet` export is the one that returns rows.
import { readSheet } from 'read-excel-file/node';

export type CellValue = string | number | boolean | Date | null;

/** A row that failed validation, identified by its spreadsheet row number. */
export type ImportIssue = { row: number; message: string };

export type ImportWarning = {
  code: string;
  message: string;
  context?: Record<string, string | number>;
};

export type Period = { year: number; month: number };

export class WorkbookError extends Error {}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export const MONTH_LABELS = MONTH_NAMES.map((name) => name[0].toUpperCase() + name.slice(1));

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function periodLabel(year: number, month: number | null): string {
  return month === null ? String(year) : monthLabel(year, month);
}

export async function readRows(buffer: Buffer): Promise<CellValue[][]> {
  try {
    // The library's own cell type includes DateConstructor, which no cell can
    // actually hold; narrowed here so the rest of the module has a real union.
    return (await readSheet(buffer)) as CellValue[][];
  } catch {
    // Covers both "not a zip" and "zip without a workbook inside": from the
    // caller's point of view they are the same mistake.
    throw new WorkbookError('That file is not a readable .xlsx workbook.');
  }
}

/**
 * Column names are matched on their letters and digits only, so `Employee No.`,
 * `employee no` and `Employee  No` are the same column. The supplied files
 * differ from each other in exactly this way.
 */
function normaliseHeader(value: CellValue): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export type HeaderMatch = { rowIndex: number; columns: Map<string, number> };

const HEADER_SEARCH_ROWS = 10;

/**
 * Finds the header by content rather than position: the salary workbook's
 * header sits on row 2, under a title row.
 */
export function findHeaderRow(rows: CellValue[][], required: string[]): HeaderMatch {
  const wanted = required.map(normaliseHeader);
  let best: { rowIndex: number; found: string[] } | null = null;

  for (let i = 0; i < Math.min(rows.length, HEADER_SEARCH_ROWS); i += 1) {
    const row = rows[i] ?? [];
    const present = row.map(normaliseHeader);
    const found = wanted.filter((name) => present.includes(name));

    if (found.length === wanted.length) {
      const columns = new Map<string, number>();
      row.forEach((cell, index) => {
        const key = normaliseHeader(cell);
        if (key && !columns.has(key)) columns.set(key, index);
      });
      return { rowIndex: i, columns };
    }

    if (!best || found.length > best.found.length) {
      best = { rowIndex: i, found: row.filter((cell) => cellText(cell) !== null).map(String) };
    }
  }

  const missing = required.filter((name, i) => {
    const row = rows[best?.rowIndex ?? 0] ?? [];
    return !row.map(normaliseHeader).includes(wanted[i]);
  });

  throw new WorkbookError(
    `The column "${missing[0]}" was not found. Columns found: ${
      best && best.found.length > 0 ? best.found.join(', ') : '(none)'
    }`,
  );
}

export function columnIndex(header: HeaderMatch, name: string): number | null {
  return header.columns.get(normaliseHeader(name)) ?? null;
}

/** `-`, empty and whitespace-only all mean "no value" -- never zero. */
export function cellText(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  if (text === '' || text === '-') return null;
  return text;
}

export function cellNumber(value: CellValue): number | 'invalid' | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'invalid';
  const text = cellText(value);
  if (text === null) return null;
  const parsed = Number(text.replace(/[\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 'invalid';
}

export function isBlankRow(row: CellValue[]): boolean {
  return row.every((cell) => cellText(cell) === null);
}

/**
 * Accepts `January 2025`, `January '25`, `Jan 2025`, `2025-01`, `01/2025`, a
 * date cell, and a bare `January` when a year is supplied from elsewhere. The
 * three workbooks use three of these forms between them.
 */
export function parseMonth(value: CellValue, fallbackYear?: number | null): Period | null {
  if (value instanceof Date) {
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
  }

  const text = cellText(value);
  if (text === null) return null;

  const named = /^([a-z]+)\.?\s*'?(\d{2,4})?$/i.exec(text.trim());
  if (named) {
    const month = MONTH_NAMES.findIndex((name) => name.startsWith(named[1].toLowerCase()));
    if (month === -1) return null;
    const year = resolveYear(named[2], fallbackYear);
    return year === null ? null : { year, month: month + 1 };
  }

  const iso = /^(\d{4})[-/](\d{1,2})$/.exec(text);
  if (iso) return validNumeric(Number(iso[1]), Number(iso[2]));

  const slashed = /^(\d{1,2})[-/](\d{4})$/.exec(text);
  if (slashed) return validNumeric(Number(slashed[2]), Number(slashed[1]));

  return null;
}

function resolveYear(raw: string | undefined, fallbackYear?: number | null): number | null {
  if (raw === undefined) return fallbackYear ?? null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return raw.length === 2 ? 2000 + value : value;
}

function validNumeric(year: number, month: number): Period | null {
  if (month < 1 || month > 12 || year < 1900 || year > 9999) return null;
  return { year, month };
}

/** The cell exactly as the sheet holds it, for error messages. */
export function rawCell(value: CellValue): string {
  if (value === null || value === undefined) return '(empty)';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Spreadsheet row numbers are 1-based, so a reader can find the row in Excel. */
export function spreadsheetRow(index: number): number {
  return index + 1;
}
