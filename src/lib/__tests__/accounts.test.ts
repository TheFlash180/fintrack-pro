import { describe, expect, it } from 'vitest';
import { netWorth } from '../accounts';
import type { Account } from '../types';

function acct(over: Partial<Account>): Account {
  return {
    key: 'a',
    owner_key: 'rickus',
    name: 'Account',
    short_name: 'Acc',
    kind: 'savings',
    is_liability: false,
    external_ref: null,
    sort_order: 1,
    stated_balance: null,
    balance_as_of: null,
    opening_balance: null,
    opening_date: null,
    ...over,
  };
}

describe('netWorth', () => {
  it('sums assets, subtracts liabilities, ignores null balances', () => {
    const accounts = [
      acct({ key: 'save', stated_balance: 112684.57, balance_as_of: '2026-07-24T13:22:00+02:00' }),
      acct({ key: 'cur', kind: 'current', stated_balance: 87860.58, balance_as_of: '2026-07-20T00:00:00+02:00' }),
      acct({ key: 'cc', kind: 'credit', is_liability: true, stated_balance: 23983.13, balance_as_of: '2026-07-24T13:22:00+02:00' }),
      acct({ key: 'fnb', owner_key: 'anjone', kind: 'current', stated_balance: null }),
    ];
    const nw = netWorth(accounts);
    expect(nw.assets).toBeCloseTo(200545.15, 2);
    expect(nw.liabilities).toBeCloseTo(23983.13, 2);
    expect(nw.net).toBeCloseTo(176562.02, 2);
    expect(nw.asOf).toBe('2026-07-24T13:22:00+02:00'); // latest as-of wins
  });

  it('is zero when no account has a reported balance', () => {
    const nw = netWorth([acct({ stated_balance: null })]);
    expect(nw.net).toBe(0);
    expect(nw.asOf).toBeNull();
  });
});
