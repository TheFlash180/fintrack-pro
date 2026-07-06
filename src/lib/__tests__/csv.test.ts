import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoMapColumns, extractRows, parseAmountFlexible, parseCsv, parseDateFlexible } from '../csv';

const fnbCsv = readFileSync(new URL('./fixtures/fnb-sample.csv', import.meta.url), 'utf8');
const capitecCsv = readFileSync(new URL('./fixtures/capitec-real.csv', import.meta.url), 'utf8');

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas', () => {
    const t = parseCsv('"a","b,c"\n"1","2"');
    expect(t.headers).toEqual(['a', 'b,c']);
    expect(t.rows).toEqual([['1', '2']]);
  });
});

describe('FNB CSV reference format', () => {
  it('auto-maps the FNB export headers to a single signed amount column', () => {
    const table = parseCsv(fnbCsv);
    const mapping = autoMapColumns(table.headers);
    expect(mapping).toEqual({
      date: 0,
      description: 3,
      amount: 1,
      moneyIn: null,
      moneyOut: null,
      fee: null,
      category: null,
    });
  });

  it('extracts all rows with correct dates, amounts, and signs', () => {
    const table = parseCsv(fnbCsv);
    const mapping = autoMapColumns(table.headers)!;
    const { ok, skipped } = extractRows(table, mapping);
    expect(skipped).toBe(0);
    expect(ok).toHaveLength(5);
    expect(ok[0]).toEqual({
      tx_date: '2026-06-01',
      description: 'FNB App Payment From Salary ABC Corp',
      amount: 24500,
    });
    expect(ok[4].amount).toBe(-2500);
    expect(ok[4].description).toContain('Baby City, Clearwater');
  });
});

describe('Capitec CSV export (real format: split Money In / Money Out / Fee)', () => {
  it('auto-maps to split columns plus the bank category column', () => {
    const table = parseCsv(capitecCsv);
    const mapping = autoMapColumns(table.headers);
    expect(mapping).toEqual({
      date: 2,
      description: 4,
      amount: null,
      moneyIn: 8,
      moneyOut: 9,
      fee: 10,
      category: 7,
    });
  });

  it('picks money-in, money-out, or fee per row and signs them correctly', () => {
    const table = parseCsv(capitecCsv);
    const mapping = autoMapColumns(table.headers)!;
    const { ok, skipped } = extractRows(table, mapping);
    expect(skipped).toBe(0);
    expect(ok).toHaveLength(6);

    const byDesc = (s: string) => ok.find((r) => r.description.includes(s))!;
    expect(byDesc('Transfer to Nuwe Foon').amount).toBe(-1000);
    expect(byDesc('Debit Order Fee').amount).toBe(-3);
    expect(byDesc('Checkers Sb079461').amount).toBe(-1505.46);
    expect(byDesc('Salary Salary 3125913287').amount).toBe(54828.38);
    expect(byDesc('Interest Received').amount).toBe(116.92);
    expect(byDesc('Purchase Refund').amount).toBe(799.99);
  });

  it('carries the bank-provided category through for categorizeWithHint to use', () => {
    const table = parseCsv(capitecCsv);
    const mapping = autoMapColumns(table.headers)!;
    const { ok } = extractRows(table, mapping);
    const groceries = ok.find((r) => r.description.includes('Checkers'))!;
    expect(groceries.category).toBe('Groceries');
    const salary = ok.find((r) => r.description.includes('Salary Salary'))!;
    expect(salary.category).toBe('Salary');
  });
});

describe('flexible parsing', () => {
  it('parses date formats', () => {
    expect(parseDateFlexible('2026/06/15')).toBe('2026-06-15');
    expect(parseDateFlexible('15/06/2026')).toBe('2026-06-15');
    expect(parseDateFlexible('2026-06-15')).toBe('2026-06-15');
    expect(parseDateFlexible('15 Jun 2026')).toBe('2026-06-15');
    expect(parseDateFlexible('nonsense')).toBeNull();
  });

  it('parses amount formats', () => {
    expect(parseAmountFlexible('1,234.56')).toBe(1234.56);
    expect(parseAmountFlexible('-1 234,56')).toBe(-1234.56);
    expect(parseAmountFlexible('(123.45)')).toBe(-123.45);
    expect(parseAmountFlexible('123.45-')).toBe(-123.45);
    expect(parseAmountFlexible('R2,500.00')).toBe(2500);
    expect(parseAmountFlexible('abc')).toBeNull();
  });
});
