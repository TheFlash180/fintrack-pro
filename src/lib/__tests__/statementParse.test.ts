import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStatementLines } from '../statementParse';

const capitecLines = readFileSync(
  new URL('./fixtures/capitec-sample.txt', import.meta.url),
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

describe('fnb profile (best-effort)', () => {
  it('parses Cr-suffixed credits and unsuffixed debits', () => {
    const rows = parseStatementLines(
      [
        '15 Jun 2026 FNB App Prepaid Airtime 99.00 12,345.67Cr',
        '16 Jun 2026 Salary ABC Corp 24,500.00Cr 36,845.67Cr',
      ],
      'fnb',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(-99);
    expect(rows[1].amount).toBe(24500);
  });
});
