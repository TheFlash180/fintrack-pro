export type OwnerKey = 'rickus' | 'anjone';
export type DashKey = OwnerKey | 'trollip';

export interface Tx {
  id: string;
  owner_key: OwnerKey;
  tx_date: string; // ISO yyyy-mm-dd
  description: string | null;
  amount: number; // positive = income, negative = expense
  category: string;
  source: string;
  dedupe_hash: string | null;
  account_key: string | null; // which account this sits in (null = owner's main)
  is_transfer: boolean; // inter-account move — excluded from income/expense
}

/** A parsed-but-not-yet-saved transaction on the review screen. */
export interface DraftTx {
  tx_date: string;
  description: string;
  amount: number;
  category: string;
  owner_key: OwnerKey;
  account_key?: string | null;
  is_transfer?: boolean;
  duplicate?: boolean;
}

/** A real-world account (current / notice-savings / credit card). Balances for
 *  the net-worth overview come from `stated_balance` (what the user reports on
 *  a date); `opening_*` anchor the transaction-based reconciliation. */
export interface Account {
  key: string;
  owner_key: OwnerKey;
  name: string;
  short_name: string;
  kind: 'current' | 'savings' | 'credit';
  is_liability: boolean;
  external_ref: string | null;
  sort_order: number;
  stated_balance: number | null;
  balance_as_of: string | null;
  opening_balance: number | null;
  opening_date: string | null;
}

export interface Budget {
  id: string;
  category: string;
  monthly_amount: number;
  effective_from: string; // first of month, yyyy-mm-dd
}

export const CATEGORIES = [
  'Groceries',
  'Fuel',
  'Housing',
  'Bond',
  'Utilities',
  'Phone & Internet',
  'Subscriptions',
  'Eating Out',
  'Transport',
  'Medical',
  'Insurance',
  'Credit Card',
  'Domestic',
  'Baby',
  'Clothing',
  'Entertainment',
  'Hobbies',
  'Holiday',
  'Personal Care',
  'Shopping',
  'Bank Fees',
  'Savings & Investments',
  'Salary',
  'Other Income',
  'Transfer',
  'Uncategorised',
] as const;

export const OWNER_LABEL: Record<OwnerKey, string> = {
  rickus: 'Rickus',
  anjone: 'Anjoné',
};
