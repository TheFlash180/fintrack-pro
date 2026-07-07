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
}

/** A parsed-but-not-yet-saved transaction on the review screen. */
export interface DraftTx {
  tx_date: string;
  description: string;
  amount: number;
  category: string;
  owner_key: OwnerKey;
  duplicate?: boolean;
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
  'Baby',
  'Clothing',
  'Entertainment',
  'Shopping',
  'Bank Fees',
  'Savings & Investments',
  'Salary',
  'Other Income',
  'Uncategorised',
] as const;

export const OWNER_LABEL: Record<OwnerKey, string> = {
  rickus: 'Rickus',
  anjone: 'Anjoné',
};
