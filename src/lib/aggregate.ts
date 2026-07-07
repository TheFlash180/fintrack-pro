import type { Budget, DashKey, Tx } from './types';
import { shiftYm } from './format';

export function filterTxs(txs: Tx[], dash: DashKey, ym: string | null): Tx[] {
  return txs.filter((t) => {
    if (dash !== 'trollip' && t.owner_key !== dash) return false;
    if (ym && !t.tx_date.startsWith(ym)) return false;
    return true;
  });
}

export interface Totals {
  income: number;
  expenses: number; // positive number (magnitude of spend)
  net: number;
}

export function totals(txs: Tx[]): Totals {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (t.amount >= 0) income += t.amount;
    else expenses += -t.amount;
  }
  return { income, expenses, net: income - expenses };
}

export interface CategorySpend {
  category: string;
  amount: number; // positive magnitude
  pct: number;
}

export function spendByCategory(txs: Tx[]): CategorySpend[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const v = -t.amount;
    map.set(t.category, (map.get(t.category) ?? 0) + v);
    total += v;
  }
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthPoint extends Totals {
  ym: string;
}

/** The `months` most recent calendar months ending at `endYm`, aggregated. */
export function monthlySeries(txs: Tx[], endYm: string, months: number): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const ym = shiftYm(endYm, -i);
    const t = totals(txs.filter((x) => x.tx_date.startsWith(ym)));
    points.push({ ym, ...t });
  }
  return points;
}

/** The budget in force for a category in a given month: the newest row whose
 *  effective_from is on/before that month. Budgets carry forward until changed. */
export function budgetFor(budgets: Budget[], category: string, ym: string): number | null {
  const monthStart = `${ym}-01`;
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.category !== category) continue;
    if (b.effective_from > monthStart) continue;
    if (!best || b.effective_from > best.effective_from) best = b;
  }
  return best ? best.monthly_amount : null;
}

/** All categories that have a budget in force for the month. */
export function budgetedCategories(budgets: Budget[], ym: string): string[] {
  const cats = new Set<string>();
  for (const b of budgets) {
    if (b.effective_from <= `${ym}-01`) cats.add(b.category);
  }
  return [...cats].sort();
}

const FIXED_CATEGORIES = new Set([
  'Housing', 'Bond', 'Insurance', 'Phone & Internet', 'Subscriptions',
  'Domestic', 'Utilities', 'Credit Card', 'Bank Fees',
]);

export interface SpendSplit {
  fixed: number;
  discretionary: number;
  total: number;
}

export function spendSplit(txs: Tx[]): SpendSplit {
  let fixed = 0;
  let discretionary = 0;
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const v = -t.amount;
    if (t.category === 'Savings & Investments') continue;
    if (FIXED_CATEGORIES.has(t.category)) fixed += v;
    else discretionary += v;
  }
  return { fixed, discretionary, total: fixed + discretionary };
}

export function savingsRate(t: Totals): number | null {
  if (t.income === 0) return null;
  return ((t.income - t.expenses) / t.income) * 100;
}
