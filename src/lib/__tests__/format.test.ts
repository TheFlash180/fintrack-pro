import { describe, expect, it } from 'vitest';
import { fmtZar, sastDay, shiftYm, toYm } from '../format';

describe('sastDay', () => {
  // SAST is UTC+2 year-round (South Africa has no DST), so the calendar day
  // rolls over two hours before UTC does. These are the hours where reaching
  // for toISOString().slice(0, 10) silently dates a row to yesterday.
  it('is still today late in the SAST evening', () => {
    // 21:30 UTC = 23:30 SAST on the 2nd
    expect(sastDay(new Date('2026-08-02T21:30:00Z'))).toBe('2026-08-02');
  });

  it('has already rolled over after 22:00 UTC', () => {
    // 22:30 UTC = 00:30 SAST on the 3rd — UTC still says the 2nd
    const t = new Date('2026-08-02T22:30:00Z');
    expect(t.toISOString().slice(0, 10)).toBe('2026-08-02'); // the trap
    expect(sastDay(t)).toBe('2026-08-03');
  });

  it('agrees with UTC during SAST working hours', () => {
    expect(sastDay(new Date('2026-08-02T09:00:00Z'))).toBe('2026-08-02');
  });

  it('rolls the month and the year over correctly', () => {
    expect(sastDay(new Date('2026-08-31T22:30:00Z'))).toBe('2026-09-01');
    expect(sastDay(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01-01');
  });
});

describe('fmtZar', () => {
  // Hand-rolled rather than toLocaleString('en-ZA'), which groups with a
  // non-breaking space on Node and a comma in browsers.
  it('groups thousands with a comma and always shows cents', () => {
    expect(fmtZar(12345.67)).toBe('R12,345.67');
    expect(fmtZar(0)).toBe('R0.00');
    expect(fmtZar(999)).toBe('R999.00');
    expect(fmtZar(1234567.5)).toBe('R1,234,567.50');
  });

  it('puts the sign before the R', () => {
    expect(fmtZar(-1250.75)).toBe('-R1,250.75');
  });
});

describe('month helpers', () => {
  it('formats and shifts yyyy-mm across year boundaries', () => {
    expect(toYm(new Date(2026, 7, 2))).toBe('2026-08');
    expect(shiftYm('2026-01', -1)).toBe('2025-12');
    expect(shiftYm('2026-12', 1)).toBe('2027-01');
    expect(shiftYm('2026-08', -12)).toBe('2025-08');
  });
});
