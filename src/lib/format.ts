const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  currencyDisplay: 'narrowSymbol',
});

/** R12,345.67 — en-ZA locale, used for every currency figure. */
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

// keep the unused zar formatter referenced so intent is documented
void zar;
