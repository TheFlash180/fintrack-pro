// CSV import: RFC-4180-ish parser (quotes, embedded commas/newlines) plus
// header auto-mapping. Two amount shapes are supported:
//   - a single signed Amount column (FNB transaction-history export), or
//   - split Money In / Money Out / Fee columns (Capitec CSV export).
// Anything unrecognised falls back to manual column mapping in the UI.

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
  amount: number | null; // single signed column…
  moneyIn: number | null; // …or split in/out(/fee) columns
  moneyOut: number | null;
  fee: number | null;
  category: number | null; // optional bank-provided category
}

/** Guess the columns from the header row (English + Afrikaans). Returns null
 *  when required columns can't be identified — the UI then asks the user. */
export function autoMapColumns(headers: string[]): ColumnMapping | null {
  /** First header matching the FIRST pattern that matches anything — the
   *  pattern list is a preference order, most specific first.
   *
   *  It has to loop patterns on the outside. Scanning headers on the outside
   *  (`headers.findIndex(h => patterns.some(...))`) returns the first matching
   *  COLUMN instead, which makes the ordering inert: with an "Original
   *  Description" column ahead of "Description", the loose `/descri/i`
   *  fallback would win over the exact `/^description$/i`. Both banks happen
   *  to order their columns so the two agree, which is why it went unnoticed. */
  const find = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = headers.findIndex((h) => p.test(h.trim()));
      if (i >= 0) return i;
    }
    return -1;
  };

  const date = find([/posting date/i, /^date$/i, /transaction date/i, /^datum/i, /date/i]);
  const description = find([/^description$/i, /narrative/i, /details/i, /beskrywing/i, /descri/i, /reference/i]);
  const moneyIn = find([/money\s?in/i, /geld\s?in/i]);
  const moneyOut = find([/money\s?out/i, /geld\s?uit/i]);
  const fee = find([/^fee(s)?$/i, /^fooi/i]);
  const category = find([/^category$/i, /^kategorie/i]);
  // `/^value$/i` (not `/value/i`) so a "Value Date" / "Value Time" column —
  // as Discovery exports use — is never mistaken for the amount column.
  const amount = find([/^amount$/i, /^bedrag/i, /amount/i, /^value$/i]);

  if (date < 0 || description < 0 || date === description) return null;

  if (moneyIn >= 0 && moneyOut >= 0) {
    return {
      date,
      description,
      amount: null,
      moneyIn,
      moneyOut,
      fee: fee >= 0 ? fee : null,
      category: category >= 0 ? category : null,
    };
  }
  if (amount < 0 || amount === date || amount === description) return null;
  return {
    date,
    description,
    amount,
    moneyIn: null,
    moneyOut: null,
    fee: null,
    category: category >= 0 ? category : null,
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mrt: 3, maa: 3, apr: 4, may: 5, mei: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
};

export function monthFromName(name: string): number | null {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? null;
}

/** Parse "2026/06/15", "15/06/2026", "2026-06-15", "15 Jun 2026",
 *  "15 Junie 2026" → yyyy-mm-dd. A trailing time ("2026-04-01 10:27") is
 *  ignored. */
export function parseDateFlexible(raw: string): string | null {
  const s = raw.trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2})?$/, '');
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-zë]{3,})\s+(\d{4})$/);
  if (m) {
    const month = monthFromName(m[2]);
    if (month) return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** Parse "1,234.56", "-1 234,56", "(123.45)", "1234.56-" → number. */
export function parseAmountFlexible(raw: string): number | null {
  let s = raw.trim().replace(/[R$  ]/g, '');
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
  category?: string; // bank-provided category hint, if the export has one
}

export function extractRows(table: CsvTable, mapping: ColumnMapping): { ok: CsvRow[]; skipped: number } {
  const ok: CsvRow[] = [];
  let skipped = 0;

  const cell = (r: string[], idx: number | null) => (idx === null ? '' : (r[idx] ?? ''));

  for (const r of table.rows) {
    const date = parseDateFlexible(cell(r, mapping.date));
    const description = cell(r, mapping.description).trim();

    // A row can carry more than one amount. Capitec normally puts a fee on a
    // row of its own, but nothing guarantees it: a purchase charged a fee can
    // fill Money Out and Fee on the SAME row, and taking only the first
    // non-zero column silently dropped the fee — money missing from the
    // ledger with nothing to show it had gone.
    const found: { amount: number; suffix: string; category?: string }[] = [];
    if (mapping.amount !== null) {
      const v = parseAmountFlexible(cell(r, mapping.amount));
      if (v !== null) found.push({ amount: v, suffix: '' });
    } else {
      // Split columns: money in = income, money out / fee = expense.
      // Capitec writes Money Out and Fee already negative; be sign-agnostic.
      const inVal = parseAmountFlexible(cell(r, mapping.moneyIn));
      const outVal = parseAmountFlexible(cell(r, mapping.moneyOut));
      const feeVal = parseAmountFlexible(cell(r, mapping.fee));
      if (inVal !== null && inVal !== 0) found.push({ amount: Math.abs(inVal), suffix: '' });
      if (outVal !== null && outVal !== 0) found.push({ amount: -Math.abs(outVal), suffix: '' });
      if (feeVal !== null && feeVal !== 0) {
        // Sharing a row with another amount means this is a charge ON that
        // transaction, so it becomes its own row: tagged in the description so
        // the review screen shows which is which, and carrying the bank's own
        // "Fees" wording so it categorises as a bank fee rather than
        // inheriting the category of the purchase it was charged on.
        const alongside = found.length > 0;
        found.push({
          amount: -Math.abs(feeVal),
          suffix: alongside ? ' (fee)' : '',
          category: alongside ? 'Fees' : undefined,
        });
      }
    }

    // Skip pending transactions (Capitec prefixes them "(Pending)"). They're
    // not final and reappear with a settled description/date on the next
    // export — importing them now would duplicate once they clear.
    if (!date || found.length === 0 || /^\(pending\)/i.test(description)) {
      skipped++;
      continue;
    }
    const category = cell(r, mapping.category).trim();
    for (const f of found) {
      const cat = f.category ?? category;
      ok.push({
        tx_date: date,
        description: description + f.suffix,
        amount: f.amount,
        ...(cat ? { category: cat } : {}),
      });
    }
  }
  return { ok, skipped };
}
