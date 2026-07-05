import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoMapColumns, extractRows, parseAmountFlexible, parseCsv, parseDateFlexible } from '../csv';

const fnbCsv = readFileSync(new URL('./fixtures/fnb-sample.csv', import.meta.url), 'utf8');

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas', () => {
    const t = parseCsv('"a","b,c"\n"1","2"');
    expect(t.headers).toEqual(['a', 'b,c']);
    expect(t.rows).toEqual([['1', '2']]);
  });
});

describe('FNB CSV reference format', () => {
  it('auto-maps the FNB export headers', () => {
    const table = parseCsv(fnbCsv);
    const mapping = autoMapColumns(table.headers);
    expect(mapping).toEqual({ date: 0, description: 3, amount: 1 });
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
