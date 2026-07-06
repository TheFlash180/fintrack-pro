import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findStatementPeriod, parseStatementLines } from '../statementParse';

const capitecLines = readFileSync(
  new URL('./fixtures/capitec-sample.txt', import.meta.url),
  'utf8',
).split('\n');

const fnbAfrikaansLines = readFileSync(
  new URL('./fixtures/fnb-pdf-lines.txt', import.meta.url),
  'utf8',
).split('\n');

describe('capitec profile', () => {
  const rows = parseStatementLines(capitecLines, 'capitec');

  it('extracts only transaction rows, skipping headers and footers', () => {
    expect(rows).toHaveLength(7);
  });

  it('parses dates to ISO and keeps descriptions clean', () => {
    expect(rows[0].tx_date).toBe('2026-06-01');
    expect(rows[0].description).toBe('Salary Payment Employer XYZ');
    expect(rows[4].tx_date).toBe('2026-06-07'); // transaction date, not posting date
  });

  it('keeps explicit signs and balances', () => {
    expect(rows[0].amount).toBe(25000);
    expect(rows[1].amount).toBe(-845.5);
    expect(rows[1].balance).toBe(26604.6);
    expect(rows[5].amount).toBe(-7.5);
  });

  it('corrects a missing minus sign from the balance movement', () => {
    // The 12/06 Pick n Pay row is unsigned in the text layer, but the balance
    // drops by 1,200 — the parser must infer the debit.
    expect(rows[6].description).toContain('Pick n Pay');
    expect(rows[6].amount).toBe(-1200);
  });
});

describe('fnb profile — real Afrikaans statement (FNB Fusion)', () => {
  it('finds the statement period to resolve year-less dates', () => {
    const period = findStatementPeriod(fnbAfrikaansLines);
    expect(period).toEqual({ startMonth: 4, startYear: 2026, endMonth: 5, endYear: 2026 });
  });

  it('resolves "18 Apr" / "16 Mei" style dates using the statement period', () => {
    const rows = parseStatementLines(fnbAfrikaansLines, 'fnb');
    expect(rows[0].tx_date).toBe('2026-04-18');
    expect(rows.at(-1)!.tx_date).toBe('2026-05-16');
  });

  it('treats Kt as credit and unsuffixed/Dt as debit', () => {
    const rows = parseStatementLines(fnbAfrikaansLines, 'fnb');
    const salary = rows.find((r) => r.description.includes('Salaris'))!;
    expect(salary.amount).toBe(27279.92); // "27,279.92Kt" = money in
    const pnp = rows.find((r) => r.description.includes('PNP Crp'))!;
    expect(pnp.amount).toBeLessThan(0); // unsuffixed amount = money out
  });

  it('strips the trailing card-reference noise from descriptions', () => {
    const rows = parseStatementLines(fnbAfrikaansLines, 'fnb');
    const pnp = rows.find((r) => r.description.includes('PNP Crp'))!;
    expect(pnp.description).toBe('POS Aankope PNP Crp Douglasdale');
    expect(pnp.description).not.toMatch(/\d{6}\*\d{4}/);
  });

  it('falls back gracefully when the text layer drops a row\'s description', () => {
    // The real statement's final fee row extracts with NO description text
    // (it collides with the verification-stamp box in the PDF layout) —
    // the row must still parse so it reaches the review screen.
    const rows = parseStatementLines(fnbAfrikaansLines, 'fnb');
    const feeRow = rows.find((r) => r.amount === -120);
    expect(feeRow).toBeDefined();
    expect(feeRow!.description).toBe('Unknown transaction');
  });

  it('does not emit a row for the closing-balance summary line', () => {
    const rows = parseStatementLines(fnbAfrikaansLines, 'fnb');
    expect(rows.some((r) => /afsluitingsaldo/i.test(r.description))).toBe(false);
  });
});
