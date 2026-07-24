import { describe, expect, it } from 'vitest';
import { netWorth, reconcileAccount, txsForAccount } from '../accounts';
import type { Account, Tx } from '../types';

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

function tx(over: Partial<Tx>): Tx {
  return {
    id: Math.random().toString(),
    owner_key: 'rickus',
    tx_date: '2026-06-15',
    description: 'x',
    amount: 0,
    category: 'Uncategorised',
    source: 'csv',
    dedupe_hash: null,
    account_key: 'a',
    is_transfer: false,
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
});

describe('reconcileAccount', () => {
  it('reconciles to the cent from the opening anchor (Nuwe Kar)', () => {
    const nuweKar = acct({ key: 'nk', stated_balance: 15113.21, opening_balance: 0, opening_date: '2026-05-11' });
    const txs = [
      tx({ account_key: 'nk', tx_date: '2026-05-11', amount: 10000, is_transfer: true }),
      tx({ account_key: 'nk', tx_date: '2026-06-10', amount: 52.66 }),
      tx({ account_key: 'nk', tx_date: '2026-07-01', amount: 5000, is_transfer: true }),
      tx({ account_key: 'nk', tx_date: '2026-07-10', amount: 60.55 }),
    ];
    const r = reconcileAccount(nuweKar, txs);
    expect(r.computed).toBeCloseTo(15113.21, 2);
    expect(r.delta).toBeCloseTo(0, 2);
    expect(r.aligned).toBe(true);
  });

  it('only counts transactions on/after the opening date', () => {
    const a = acct({ key: 'nk', stated_balance: 100, opening_balance: 100, opening_date: '2026-06-01' });
    const txs = [
      tx({ account_key: 'nk', tx_date: '2026-05-01', amount: -999 }), // before anchor, ignored
      tx({ account_key: 'nk', tx_date: '2026-06-02', amount: 0 }),
    ];
    expect(reconcileAccount(a, txs).computed).toBeCloseTo(100, 2);
  });

  it('surfaces a mismatch as a non-zero delta', () => {
    const a = acct({ key: 'nk', stated_balance: 90, opening_balance: 0, opening_date: '2026-06-01' });
    const txs = [tx({ account_key: 'nk', tx_date: '2026-06-02', amount: 100 })];
    const r = reconcileAccount(a, txs);
    expect(r.computed).toBeCloseTo(100, 2);
    expect(r.delta).toBeCloseTo(-10, 2);
    expect(r.aligned).toBe(false);
  });

  it('returns computed=null when the account has no opening anchor', () => {
    const disc = acct({ key: 'ds', stated_balance: 112684.57 });
    const r = reconcileAccount(disc, [tx({ account_key: 'ds', amount: 482.03 })]);
    expect(r.computed).toBeNull();
    expect(r.aligned).toBeNull();
  });
});

describe('txsForAccount', () => {
  it('treats null account_key as the owner main account', () => {
    const main = acct({ key: 'capitec-savings', kind: 'current' });
    const txs = [
      tx({ id: '1', account_key: null }), // legacy row → main
      tx({ id: '2', account_key: 'capitec-savings' }),
      tx({ id: '3', account_key: 'nuwe-kar' }),
    ];
    const got = txsForAccount(txs, main, 'capitec-savings').map((t) => t.id);
    expect(got).toEqual(['1', '2']);
  });
});
