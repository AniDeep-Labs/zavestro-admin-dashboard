// Lightweight CSV export (G17) — no dependency. Builds an RFC-4180-ish CSV and
// triggers a browser download. A UTF-8 BOM is prepended so Excel opens it with
// the right encoding (₹, accented names, etc.).

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote when the cell contains a comma, quote, or newline; double inner quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))
    .join('\r\n');
  return `﻿${head}\r\n${body}`;
}

/** Build a CSV from `rows` and download it as `<filename>`. */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** `orders-2026-06-03.csv` — date-stamped name for an export. */
export function datedFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
