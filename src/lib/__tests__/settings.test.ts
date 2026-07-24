import { describe, expect, it } from 'vitest';
import { getDefaults, withRequired } from '../settings';

describe('withRequired', () => {
  it('adds Transfer to a saved list that predates the accounts feature', () => {
    // The stored settings row replaces the defaults wholesale, so a category
    // the app assigns on its own must be re-added or it is never selectable.
    const stored = ['Groceries', 'Fuel', 'Salary', 'Uncategorised'];
    expect(withRequired(stored)).toContain('Transfer');
  });

  it('adds Uncategorised when a saved list somehow lacks it', () => {
    expect(withRequired(['Groceries'])).toEqual(
      expect.arrayContaining(['Transfer', 'Uncategorised']),
    );
  });

  it('does not duplicate categories that are already present', () => {
    const list = withRequired(getDefaults().categories);
    expect(list.filter((c) => c === 'Transfer')).toHaveLength(1);
    expect(list.filter((c) => c === 'Uncategorised')).toHaveLength(1);
  });

  it('returns the same array reference when nothing is missing', () => {
    const list = ['Transfer', 'Uncategorised'];
    expect(withRequired(list)).toBe(list);
  });

  it('preserves the order of the user\'s own categories', () => {
    expect(withRequired(['Fuel', 'Groceries', 'Uncategorised']).slice(0, 3)).toEqual([
      'Fuel',
      'Groceries',
      'Uncategorised',
    ]);
  });

  it('ships Transfer in the defaults too', () => {
    expect(getDefaults().categories).toContain('Transfer');
  });
});
