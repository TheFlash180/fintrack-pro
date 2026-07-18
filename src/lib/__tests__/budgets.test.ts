import { describe, expect, it } from 'vitest';
import { budgetFor, budgetedCategories } from '../aggregate';
import type { Budget } from '../types';

function budget(category: string, effective_from: string, monthly_amount: number): Budget {
  return { id: `${category}-${effective_from}`, category, monthly_amount, effective_from };
}

const BUDGETS: Budget[] = [
  budget('Groceries', '2026-02-01', 8000),
  budget('Groceries', '2026-05-01', 9500),
  budget('Fuel', '2026-03-01', 3000),
];

describe('budgetFor — carry-forward semantics', () => {
  it('returns null before the first effective month', () => {
    expect(budgetFor(BUDGETS, 'Groceries', '2026-01')).toBeNull();
  });

  it('carries a budget forward until a newer row takes over', () => {
    expect(budgetFor(BUDGETS, 'Groceries', '2026-02')).toBe(8000);
    expect(budgetFor(BUDGETS, 'Groceries', '2026-04')).toBe(8000);
    expect(budgetFor(BUDGETS, 'Groceries', '2026-05')).toBe(9500);
    expect(budgetFor(BUDGETS, 'Groceries', '2026-12')).toBe(9500);
  });

  it('is insensitive to row order (edits can insert history out of order)', () => {
    const shuffled = [BUDGETS[1], BUDGETS[2], BUDGETS[0]];
    expect(budgetFor(shuffled, 'Groceries', '2026-04')).toBe(8000);
    expect(budgetFor(shuffled, 'Groceries', '2026-06')).toBe(9500);
  });

  it('returns null for categories with no budget at all', () => {
    expect(budgetFor(BUDGETS, 'Entertainment', '2026-06')).toBeNull();
  });
});

describe('budgetedCategories', () => {
  it('lists only categories whose budget is in force by that month', () => {
    expect(budgetedCategories(BUDGETS, '2026-01')).toEqual([]);
    expect(budgetedCategories(BUDGETS, '2026-02')).toEqual(['Groceries']);
    expect(budgetedCategories(BUDGETS, '2026-03')).toEqual(['Fuel', 'Groceries']);
  });
});
