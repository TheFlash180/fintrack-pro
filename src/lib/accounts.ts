import type { Account } from './types';

export interface NetWorth {
  assets: number;
  liabilities: number;
  net: number;
  asOf: string | null;
}

/** Net worth from the balances the user reports (and edits) in-app. FinTrack
 *  stays a budgeting tool, not a bookkeeping one: these are quick snapshot
 *  figures, not reconciled-from-statements totals. Liabilities (the credit
 *  card) are stored as a positive amount owed and subtracted. */
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
