// Bank-statement line parsing. The PDF text extraction (pdf.js) lives in
// pdfExtract.ts; everything here is pure string→rows logic so it unit-tests
// without a browser. Strategy pattern: one named profile per bank.
//
// The FNB profile is built against the real (Afrikaans) FNB Fusion statement:
// rows carry "18 Mei"-style dates WITHOUT a year (resolved from the
// "Staat Periode : 17 April 2026 tot 16 Mei 2026" header), credits are
// suffixed Kt (or Cr in English statements), debits are unsuffixed or Dt/Dr.

import { monthFromName, parseDateFlexible } from './csv';

export type StatementProfile = 'capitec' | 'fnb';

export interface StatementRow {
  tx_date: string;
  description: string;
  amount: number;
  balance: number | null;
}

// money token: 1,234.56 / -250.00 / 250.00- / (250.00) / 123.45Kt
const MONEY = /-?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s?(?:Cr|Dr|Kt|Dt))?-?/gi;

function parseMoney(token: string): { value: number; credit: boolean | null } {
  let t = token.replace(/[, ]/g, '');
  let credit: boolean | null = null;
  if (/(cr|kt)$/i.test(t)) {
    credit = true;
    t = t.replace(/(cr|kt)$/i, '');
  } else if (/(dr|dt)$/i.test(t)) {
    credit = false;
    t = t.replace(/(dr|dt)$/i, '');
  }
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  if (t.endsWith('-')) {
    negative = true;
    t = t.slice(0, -1);
  }
  if (t.startsWith('-')) {
    negative = true;
    t = t.slice(1);
  }
  return { value: negative ? -Number(t) : Number(t), credit };
}

function balanceValue(tok: string | null): number | null {
  if (tok === null) return null;
  const m = parseMoney(tok);
  // A Dt/Dr balance is an overdraft — store it negative.
  return m.credit === false ? -Math.abs(m.value) : m.value;
}

/** Capitec statements: rows start with dd/mm/yyyy (sometimes a second posting
 *  date follows), description in the middle, then amount and balance at the
 *  end. Signs are corrected afterwards from balance movement where possible. */
function parseCapitecLine(line: string): StatementRow | null {
  const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})(?:\s+\d{2}\/\d{2}\/\d{4})?\s+/);
  if (!dateMatch) return null;
  const tx_date = parseDateFlexible(dateMatch[1]);
  if (!tx_date) return null;

  const rest = line.slice(dateMatch[0].length);
  const tokens = [...rest.matchAll(MONEY)];
  if (tokens.length === 0) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
  const amountTok = secondLast ?? last;
  const balanceTok = secondLast ? last[0] : null;

  const description = rest.slice(0, amountTok.index).trim();
  if (!description) return null;

  const amount = parseMoney(amountTok[0]);
  let value = amount.value;
  if (amount.credit === true) value = Math.abs(value);
  if (amount.credit === false) value = -Math.abs(value);

  return { tx_date, description, amount: value, balance: balanceValue(balanceTok) };
}

interface PeriodContext {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

/** Find "Staat Periode : 17 April 2026 tot 16 Mei 2026" (or the English
 *  "Statement Period: … to …") anywhere in the document. */
export function findStatementPeriod(lines: string[]): PeriodContext | null {
  for (const line of lines) {
    const m = line.match(
      /(?:periode|period)\s*:?\s*(\d{1,2})\s+([A-Za-zë]{3,12})\s+(\d{4})\s+(?:tot|to|-)\s+(\d{1,2})\s+([A-Za-zë]{3,12})\s+(\d{4})/i,
    );
    if (!m) continue;
    const startMonth = monthFromName(m[2]);
    const endMonth = monthFromName(m[5]);
    if (!startMonth || !endMonth) continue;
    return {
      startMonth,
      startYear: Number(m[3]),
      endMonth,
      endYear: Number(m[6]),
    };
  }
  return null;
}

function resolveYear(month: number, period: PeriodContext | null): number {
  if (!period) return new Date().getFullYear();
  if (period.startYear === period.endYear) return period.startYear;
  // Period crosses a year boundary (e.g. Des → Jan).
  return month >= period.startMonth ? period.startYear : period.endYear;
}

/** Drop the trailing card reference ("405769*7926 16 Apr") FNB appends to
 *  card rows — it's noise in a transaction description. */
function cleanFnbDescription(desc: string): string {
  return desc
    .replace(/\s*\d{6}\*\d{4}(\s+\d{1,2}\s+[A-Za-zë]{3,9})?\s*$/, '')
    .replace(/^#/, '')
    .trim();
}

function parseFnbLine(line: string, period: PeriodContext | null): StatementRow | null {
  const dateMatch = line.match(
    /^\s*(?:(\d{1,2})\s+([A-Za-zë]{3,9})\s+(\d{4})|(\d{1,2})\s+([A-Za-zë]{3,9})|(\d{2}\/\d{2}\/\d{4})|(\d{4}\/\d{2}\/\d{2}))\s+/,
  );
  if (!dateMatch) return null;

  let tx_date: string | null = null;
  if (dateMatch[6] || dateMatch[7]) {
    tx_date = parseDateFlexible(dateMatch[6] ?? dateMatch[7]);
  } else if (dateMatch[3]) {
    tx_date = parseDateFlexible(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
  } else if (dateMatch[4] && dateMatch[5]) {
    const month = monthFromName(dateMatch[5]);
    if (month) {
      const year = resolveYear(month, period);
      tx_date = `${year}-${String(month).padStart(2, '0')}-${dateMatch[4].padStart(2, '0')}`;
    }
  }
  if (!tx_date) return null;

  const rest = line.slice(dateMatch[0].length);
  const tokens = [...rest.matchAll(MONEY)];
  if (tokens.length === 0) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
  const amountTok = secondLast ?? last;
  const balanceTok = secondLast ? last[0] : null;

  // Rows whose description didn't survive text extraction still parse; the
  // review screen lets the user fill the description in.
  const description =
    cleanFnbDescription(rest.slice(0, amountTok.index)) || 'Unknown transaction';

  const amount = parseMoney(amountTok[0]);
  let value = amount.value;
  // FNB convention: Kt/Cr = money in; unsuffixed or Dt/Dr = money out.
  if (amount.credit === true) value = Math.abs(value);
  else value = -Math.abs(value);

  return { tx_date, description, amount: value, balance: balanceValue(balanceTok) };
}

/** Where consecutive rows carry balances, the balance movement tells us the
 *  true sign of each amount — fixes statements whose text layer drops the
 *  minus sign or splits in/out columns ambiguously. */
export function correctSignsFromBalances(rows: StatementRow[]): StatementRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const cur = out[i];
    if (prev.balance === null || cur.balance === null) continue;
    const delta = Number((cur.balance - prev.balance).toFixed(2));
    if (Math.abs(Math.abs(delta) - Math.abs(cur.amount)) < 0.005) {
      cur.amount = delta;
    }
  }
  return out;
}

export function parseStatementLines(
  lines: string[],
  profile: StatementProfile,
): StatementRow[] {
  const rows: StatementRow[] = [];
  if (profile === 'capitec') {
    for (const line of lines) {
      const row = parseCapitecLine(line);
      if (row) rows.push(row);
    }
  } else {
    const period = findStatementPeriod(lines);
    for (const line of lines) {
      // Skip obvious non-transaction summary rows.
      if (/openingsaldo|afsluitingsaldo|opening balance|closing balance/i.test(line)) continue;
      const row = parseFnbLine(line, period);
      if (row) rows.push(row);
    }
  }
  return correctSignsFromBalances(rows);
}
