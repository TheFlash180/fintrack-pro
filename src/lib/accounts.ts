import type { Account, Tx } from './types';

/** All transactions belonging to an account. Historical rows imported before
 *  accounts existed carry account_key = null; those are treated as the owner's
 *  main current account so nothing is stranded. */
export function txsForAccount(txs: Tx[], account: Account, mainKeyForOwner: string): Tx[] {
  return txs.filter((t) => {
    if (t.owner_key !== account.owner_key) return false;
    const key = t.account_key ?? mainKeyForOwner;
    return key === account.key;
  });
}

export interface AccountSummary {
  count: number;
  movement: number; // signed sum of all transactions (incl. transfers)
  lastDate: string | null;
}

export function summariseAccount(accountTxs: Tx[]): AccountSummary {
  let movement = 0;
  let lastDate: string | null = null;
  for (const t of accountTxs) {
    movement += t.amount;
    if (!lastDate || t.tx_date > lastDate) lastDate = t.tx_date;
  }
  return { count: accountTxs.length, movement, lastDate };
}

export interface Reconciliation {
  computed: number | null; // opening + movements since opening_date; null if no anchor
  stated: number | null;
  delta: number | null; // stated − computed; ~0 means the books balance
  aligned: boolean | null; // within R1
}

/** Reconcile an account's transaction history against the balance the user
 *  reported. Balances include transfers (they genuinely move money); only the
 *  income/expense analysis excludes them. Accounts without an opening anchor
 *  (Discovery exports carry no running balance) return computed = null. */
export function reconcileAccount(account: Account, accountTxs: Tx[]): Reconciliation {
  const stated = account.stated_balance;
  if (account.opening_balance == null || account.opening_date == null) {
    return { computed: null, stated, delta: null, aligned: null };
  }
  let sum = account.opening_balance;
  for (const t of accountTxs) {
    if (t.tx_date >= account.opening_date) sum += t.amount;
  }
  const computed = Math.round(sum * 100) / 100;
  const delta = stated == null ? null : Math.round((stated - computed) * 100) / 100;
  return { computed, stated, delta, aligned: delta == null ? null : Math.abs(delta) < 1 };
}

export interface NetWorth {
  assets: number;
  liabilities: number;
  net: number;
  asOf: string | null;
}

/** Net worth from the balances the user reported (the reliable figure — it
 *  doesn't depend on how much statement history has been imported). Liabilities
 *  (the credit card) are stored as a positive amount owed and subtracted. */
export function netWorth(accounts: Account[]): NetWorth {
  let assets = 0;
  let liabilities = 0;
  let asOf: string | null = null;
  for (const a of accounts) {
    if (a.stated_balance == null) continue;
    if (a.is_liability) liabilities += a.stated_balance;
    else assets += a.stated_balance;
    if (a.balance_as_of && (!asOf || a.balance_as_of > asOf)) asOf = a.balance_as_of;
  }
  return { assets, liabilities, net: assets - liabilities, asOf };
}
