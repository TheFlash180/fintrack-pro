import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { dedupeHash } from './dedupe';
import type { Account, Budget, DraftTx, Tx } from './types';

// The whole household history is small (personal-finance scale), so we fetch
// it once and aggregate client-side; dashboards and filters are then instant.
const MAX_ROWS = 50000;

const TX_COLS_FULL =
  'id, owner_key, tx_date, description, amount, category, source, dedupe_hash, account_key, is_transfer';
const TX_COLS_LEGACY =
  'id, owner_key, tx_date, description, amount, category, source, dedupe_hash';

/** Fetch transactions, tolerating a database that hasn't had migration 003
 *  applied yet: if the account_key / is_transfer columns don't exist, fall
 *  back to the legacy columns and default them, so the app never hard-fails
 *  during the window between deploy and migration. */
async function fetchTxs(): Promise<{ data: Tx[] | null; error: unknown }> {
  const full = await supabase
    .from('transactions')
    .select(TX_COLS_FULL)
    .order('tx_date', { ascending: false })
    .range(0, MAX_ROWS - 1);
  if (!full.error) {
    return { data: normalizeTxs(full.data as Record<string, unknown>[]), error: null };
  }
  const legacy = await supabase
    .from('transactions')
    .select(TX_COLS_LEGACY)
    .order('tx_date', { ascending: false })
    .range(0, MAX_ROWS - 1);
  if (legacy.error) return { data: null, error: legacy.error };
  return { data: normalizeTxs(legacy.data as Record<string, unknown>[]), error: null };
}

function normalizeTxs(rows: Record<string, unknown>[]): Tx[] {
  return rows.map((t) => ({
    id: t.id as string,
    owner_key: t.owner_key as Tx['owner_key'],
    tx_date: t.tx_date as string,
    description: (t.description as string) ?? null,
    amount: Number(t.amount),
    category: t.category as string,
    source: t.source as string,
    dedupe_hash: (t.dedupe_hash as string) ?? null,
    account_key: (t.account_key as string) ?? null,
    is_transfer: Boolean(t.is_transfer),
  }));
}

export function useFinData(enabled: boolean) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [txRes, bRes, aRes] = await Promise.all([
      fetchTxs(),
      supabase.from('budgets').select('id, category, monthly_amount, effective_from'),
      // The accounts table only exists after migration 003; a failure here is
      // not fatal — the overview simply stays hidden until it's applied.
      supabase
        .from('fintrack_accounts')
        .select(
          'key, owner_key, name, short_name, kind, is_liability, external_ref, sort_order, stated_balance, balance_as_of, opening_balance, opening_date',
        )
        .order('sort_order'),
    ]);
    if (txRes.error || bRes.error) {
      setError('Could not load your data — check your connection and refresh.');
    } else {
      setTxs(txRes.data ?? []);
      setBudgets(
        (bRes.data as Budget[]).map((b) => ({ ...b, monthly_amount: Number(b.monthly_amount) })),
      );
      setAccounts(
        aRes.error
          ? []
          : (aRes.data as Record<string, unknown>[]).map((a) => ({
              key: a.key as string,
              owner_key: a.owner_key as Account['owner_key'],
              name: a.name as string,
              short_name: a.short_name as string,
              kind: a.kind as Account['kind'],
              is_liability: Boolean(a.is_liability),
              external_ref: (a.external_ref as string) ?? null,
              sort_order: Number(a.sort_order),
              stated_balance: a.stated_balance == null ? null : Number(a.stated_balance),
              balance_as_of: (a.balance_as_of as string) ?? null,
              opening_balance: a.opening_balance == null ? null : Number(a.opening_balance),
              opening_date: (a.opening_date as string) ?? null,
            })),
      );
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { txs, budgets, accounts, loading, error, refresh };
}

export async function hashDraft(d: DraftTx): Promise<string> {
  return dedupeHash(d.tx_date, d.amount, d.description);
}

/** Build the full set of hashes (with _N suffixes for same-hash rows) that
 *  would be used during insert, so the duplicate check matches exactly. */
export async function buildBatchHashes(drafts: DraftTx[]): Promise<string[]> {
  const baseHashes = await Promise.all(drafts.map(hashDraft));
  const counts = new Map<string, number>();
  return baseHashes.map((h, i) => {
    const key = `${drafts[i].owner_key}|${h}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n === 1 ? h : `${h}_${n}`;
  });
}

/** PostgREST encodes `.in()` filters in the request URL, so a big statement
 *  (a year of transactions ≈ 700 hashes ≈ 45KB of URL) blows the server's
 *  URL limit. Query in chunks small enough to always fit. */
const HASH_LOOKUP_CHUNK = 100;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Which of these drafts already exist in the database (same owner + hash)?
 *  Throws when a lookup fails — a failed check must never read as "no
 *  duplicates found", or a re-import would silently double-count. */
export async function findExistingHashes(drafts: DraftTx[]): Promise<Set<string>> {
  const hashes = await buildBatchHashes(drafts);
  const existing = new Set<string>();
  const owners = [...new Set(drafts.map((d) => d.owner_key))];
  for (const owner of owners) {
    const ownerHashes = hashes.filter((_, i) => drafts[i].owner_key === owner);
    if (ownerHashes.length === 0) continue;
    const unique = [...new Set(ownerHashes)];
    for (const chunk of chunkArray(unique, HASH_LOOKUP_CHUNK)) {
      const { data, error } = await supabase
        .from('transactions')
        .select('dedupe_hash')
        .eq('owner_key', owner)
        .in('dedupe_hash', chunk);
      if (error) {
        throw new Error(`duplicate check failed: ${error.message}`);
      }
      for (const row of data ?? []) {
        if (row.dedupe_hash) existing.add(`${owner}|${row.dedupe_hash}`);
      }
    }
  }
  return existing;
}

export function existsKey(owner: string, hash: string): string {
  return `${owner}|${hash}`;
}

/** Insert reviewed drafts. Returns the IDs of inserted rows so they can be
 *  undone as a batch. Duplicates should already be filtered out by the review
 *  step; the partial unique index on (owner_key, dedupe_hash) acts as a
 *  safety net at the DB level.
 *
 *  `precomputedHashes` must be aligned with `drafts` and come from
 *  buildBatchHashes over the FULL review list, so the _N suffixes match what
 *  the duplicate check saw. Recomputing them here over a filtered subset
 *  would drop a suffix and collide with an already-imported twin row. */
export async function insertDrafts(
  drafts: DraftTx[],
  source: string,
  userId: string,
  precomputedHashes?: string[],
): Promise<{ inserted: number; ids: string[]; error: string | null }> {
  if (drafts.length === 0) return { inserted: 0, ids: [], error: null };
  let hashes: string[];
  if (precomputedHashes && precomputedHashes.length === drafts.length) {
    hashes = precomputedHashes;
  } else {
    hashes = await buildBatchHashes(drafts);
  }
  const rows = drafts.map((d, i) => ({
    owner_key: d.owner_key,
    tx_date: d.tx_date,
    description: d.description,
    amount: d.amount,
    category: d.category,
    source,
    dedupe_hash: hashes[i],
    created_by: userId,
    account_key: d.account_key ?? null,
    is_transfer: d.is_transfer ?? false,
  }));
  const { data, error } = await supabase
    .from('transactions')
    .insert(rows)
    .select('id');
  if (error) return { inserted: 0, ids: [], error: error.message };
  const ids = (data ?? []).map((r) => r.id as string);
  return { inserted: ids.length, ids, error: null };
}

/** Delete a batch of transactions by their IDs (undo an import). */
export async function deleteBatch(ids: string[]): Promise<{ deleted: number; error: string | null }> {
  if (ids.length === 0) return { deleted: 0, error: null };
  const { error, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .in('id', ids);
  if (error) return { deleted: 0, error: error.message };
  return { deleted: count ?? ids.length, error: null };
}

export async function updateTx(
  id: string,
  patch: Partial<Pick<Tx, 'tx_date' | 'description' | 'amount' | 'category' | 'owner_key'>>,
  fullTx?: Pick<Tx, 'tx_date' | 'description' | 'amount'>,
): Promise<boolean> {
  const updates: Record<string, unknown> = { ...patch };
  if (fullTx && ('tx_date' in patch || 'amount' in patch || 'description' in patch)) {
    const date = patch.tx_date ?? fullTx.tx_date;
    const amount = patch.amount ?? fullTx.amount;
    const desc = patch.description ?? fullTx.description ?? '';
    updates.dedupe_hash = await dedupeHash(date, amount, desc);
  }
  const { error } = await supabase.from('transactions').update(updates).eq('id', id);
  return !error;
}

export async function deleteTx(id: string): Promise<boolean> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  return !error;
}

/** Set a category's budget from this month forward (upserts the month row). */
export async function saveBudget(
  category: string,
  monthlyAmount: number,
  ym: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { category, monthly_amount: monthlyAmount, effective_from: `${ym}-01` },
      { onConflict: 'category,effective_from' },
    );
  return !error;
}

/** Save edited account balances. Stamps balance_as_of = now for any account
 *  given a figure; clearing a field (null) clears its as-of too. */
export async function saveAccountBalances(
  updates: { key: string; stated_balance: number | null }[],
): Promise<boolean> {
  if (updates.length === 0) return true;
  const asOf = new Date().toISOString();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from('fintrack_accounts')
        .update({
          stated_balance: u.stated_balance,
          balance_as_of: u.stated_balance == null ? null : asOf,
        })
        .eq('key', u.key),
    ),
  );
  return results.every((r) => !r.error);
}

export async function renameCategory(
  oldName: string,
  newName: string,
): Promise<boolean> {
  const [txRes, budgetRes] = await Promise.all([
    supabase.from('transactions').update({ category: newName }).eq('category', oldName),
    supabase.from('budgets').update({ category: newName }).eq('category', oldName),
  ]);
  return !txRes.error && !budgetRes.error;
}

export async function deleteAllBudgetsForCategory(
  category: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('category', category);
  return !error;
}
