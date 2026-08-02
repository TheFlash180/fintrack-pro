/** Today as a South African calendar day, yyyy-mm-dd.
 *
 *  Not `new Date().toISOString().slice(0, 10)`: SAST is UTC+2, so between
 *  midnight and 02:00 that returns YESTERDAY — which is exactly when someone
 *  is doing late-night admin and adding a row by hand. en-CA is used because
 *  it formats as yyyy-mm-dd, matching how tx_date is stored and compared. */
export function sastDay(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

/** R12,345.67 — used for every currency figure. */
export function fmtZar(n: number): string {
  // en-ZA formats as "R 12 345,67"; the household prefers R12,345.67.
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}R${grouped}.${dec}`;
}

export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
}

export function fmtMonthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', {
    month: 'short',
    year: '2-digit',
  });
}

/** yyyy-mm for a Date */
export function toYm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYm(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split('-').map(Number);
  return toYm(new Date(y, m - 1 + deltaMonths, 1));
}
