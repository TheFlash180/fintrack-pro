// Bank-statement line parsing. The PDF text extraction (pdf.js) lives in
// pdfExtract.ts; everything here is pure string→rows logic so it unit-tests
// without a browser. Strategy pattern: one named profile per bank.

import { parseDateFlexible } from './csv';

export type StatementProfile = 'capitec' | 'fnb';

export interface StatementRow {
  tx_date: string;
  description: string;
  amount: number;
  balance: number | null;
}

// money token: 1,234.56 / 1 234.56 / -250.00 / 250.00- / (250.00) / 123.45Cr
const MONEY = /-?\(?\d{1,3}(?:[ , ]\d{3})*\.\d{2}\)?(?:\s?(?:Cr|Dr))?-?/g;

function parseMoney(token: string): { value: number; credit: boolean | null } {
  let t = token.replace(/[ , ]/g, '');
  let credit: boolean | null = null;
  if (/cr$/i.test(t)) {
    credit = true;
    t = t.replace(/cr$/i, '');
  } else if (/dr$/i.test(t)) {
    credit = false;
    t = t.replace(/dr$/i, '');
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
  const balanceTok = secondLast ? last : null;

  const description = rest.slice(0, amountTok.index).trim();
  if (!description) return null;

  const amount = parseMoney(amountTok[0]);
  const balance = balanceTok ? parseMoney(balanceTok[0]) : null;

  let value = amount.value;
  if (amount.credit === true) value = Math.abs(value);
  if (amount.credit === false) value = -Math.abs(value);

  return {
    tx_date,
    description,
    amount: value,
    balance: balance ? balance.value : null,
  };
}

/** FNB statements (best-effort — CSV export is the primary FNB path):
 *  rows like "15 Jun 2026 Description 1,234.56Cr 10,000.00Cr". Credits carry
 *  a Cr suffix; unsuffixed amounts are debits. */
function parseFnbLine(line: string): StatementRow | null {
  const dateMatch = line.match(
    /^\s*(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{4})?|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2})\s+/,
  );
  if (!dateMatch) return null;
  const tx_date = parseDateFlexible(dateMatch[1]);
  if (!tx_date) return null;

  const rest = line.slice(dateMatch[0].length);
  const tokens = [...rest.matchAll(MONEY)];
  if (tokens.length === 0) return null;

  const last = tokens[tokens.length - 1];
  const secondLast = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
  const amountTok = secondLast ?? last;
  const balanceTok = secondLast ? last : null;

  const description = rest.slice(0, amountTok.index).trim();
  if (!description) return null;

  const amount = parseMoney(amountTok[0]);
  let value = amount.value;
  // FNB convention: Cr = money in; plain = money out.
  if (amount.credit === true) value = Math.abs(value);
  else if (amount.credit === false || amount.credit === null) value = -Math.abs(value);

  const balance = balanceTok ? parseMoney(balanceTok[0]) : null;
  return { tx_date, description, amount: value, balance: balance ? balance.value : null };
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
  const parseLine = profile === 'capitec' ? parseCapitecLine : parseFnbLine;
  const rows: StatementRow[] = [];
  for (const line of lines) {
    const row = parseLine(line);
    if (row) rows.push(row);
  }
  return correctSignsFromBalances(rows);
}
