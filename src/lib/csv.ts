// CSV import: RFC-4180-ish parser (quotes, embedded commas/newlines) plus
// header auto-mapping. FNB's transaction-history export is the reference
// format; anything unrecognised falls back to manual column mapping in the UI.

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, ''); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);

  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0].map((h) => h.trim()), rows: rows.slice(1) };
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
}

/** Guess which columns are date/description/amount from the header row.
 *  Returns null when a required column can't be identified — the UI then
 *  asks the user to map columns manually. */
export function autoMapColumns(headers: string[]): ColumnMapping | null {
  const find = (patterns: RegExp[]) =>
    headers.findIndex((h) => patterns.some((p) => p.test(h.trim())));

  const date = find([/^date$/i, /transaction date/i, /^datum/i, /date/i]);
  const description = find([/^description$/i, /narrative/i, /details/i, /reference/i, /beskrywing/i, /descri/i]);
  const amount = find([/^amount$/i, /^bedrag/i, /amount/i, /value/i]);

  if (date < 0 || description < 0 || amount < 0) return null;
  if (date === amount || date === description || description === amount) return null;
  return { date, description, amount };
}

/** Parse "2026/06/15", "15/06/2026", "2026-06-15", "15 Jun 2026" → yyyy-mm-dd. */
export function parseDateFlexible(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const idx = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Parse "1,234.56", "-1 234,56", "(123.45)", "1234.56-" → number. */
export function parseAmountFlexible(raw: string): number | null {
  let s = raw.trim().replace(/[R$  ]/g, '');
  if (s === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }
  // decide decimal separator: last of . or ,
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export interface CsvRow {
  tx_date: string;
  description: string;
  amount: number;
}

export function extractRows(table: CsvTable, mapping: ColumnMapping): { ok: CsvRow[]; skipped: number } {
  const ok: CsvRow[] = [];
  let skipped = 0;
  for (const r of table.rows) {
    const date = parseDateFlexible(r[mapping.date] ?? '');
    const amount = parseAmountFlexible(r[mapping.amount] ?? '');
    const description = (r[mapping.description] ?? '').trim();
    if (!date || amount === null) {
      skipped++;
      continue;
    }
    ok.push({ tx_date: date, description, amount });
  }
  return { ok, skipped };
}
