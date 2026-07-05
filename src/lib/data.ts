import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { dedupeHash } from './dedupe';
import type { Budget, DraftTx, Tx } from './types';

// The whole household history is small (personal-finance scale), so we fetch
// it once and aggregate client-side; dashboards and filters are then instant.
const MAX_ROWS = 50000;

export function useFinData(enabled: boolean) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [txRes, bRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, owner_key, tx_date, description, amount, category, source, dedupe_hash')
        .order('tx_date', { ascending: false })
        .range(0, MAX_ROWS - 1),
      supabase.from('budgets').select('id, category, monthly_amount, effective_from'),
    ]);
    if (txRes.error || bRes.error) {
      setError('Could not load your data — check your connection and refresh.');
    } else {
      setTxs((txRes.data as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) })));
      setBudgets(
        (bRes.data as Budget[]).map((b) => ({ ...b, monthly_amount: Number(b.monthly_amount) })),
      );
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { txs, budgets, loading, error, refresh };
}

export async function hashDraft(d: DraftTx): Promise<string> {
  return dedupeHash(d.tx_date, d.amount, d.description);
}

/** Which of these drafts already exist in the database (same owner + hash)? */
export async function findExistingHashes(drafts: DraftTx[]): Promise<Set<string>> {
  const hashes = await Promise.all(drafts.map(hashDraft));
  const existing = new Set<string>();
  const owners = [...new Set(drafts.map((d) => d.owner_key))];
  for (const owner of owners) {
    const ownerHashes = hashes.filter((_, i) => drafts[i].owner_key === owner);
    if (ownerHashes.length === 0) continue;
    const { data } = await supabase
      .from('transactions')
      .select('dedupe_hash')
      .eq('owner_key', owner)
      .in('dedupe_hash', ownerHashes);
    for (const row of data ?? []) {
      if (row.dedupe_hash) existing.add(`${owner}|${row.dedupe_hash}`);
    }
  }
  return existing;
}

export function existsKey(owner: string, hash: string): string {
  return `${owner}|${hash}`;
}

/** Insert reviewed drafts. Duplicates are skipped by the unique index; returns
 *  how many rows were actually written. */
export async function insertDrafts(
  drafts: DraftTx[],
  source: string,
  userId: string,
): Promise<{ inserted: number; error: string | null }> {
  if (drafts.length === 0) return { inserted: 0, error: null };
  const rows = await Promise.all(
    drafts.map(async (d) => ({
      owner_key: d.owner_key,
      tx_date: d.tx_date,
      description: d.description,
      amount: d.amount,
      category: d.category,
      source,
      dedupe_hash: await hashDraft(d),
      created_by: userId,
    })),
  );
  const { data, error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'owner_key,dedupe_hash', ignoreDuplicates: true })
    .select('id');
  if (error) return { inserted: 0, error: error.message };
  return { inserted: data?.length ?? 0, error: null };
}

export async function updateTx(
  id: string,
  patch: Partial<Pick<Tx, 'tx_date' | 'description' | 'amount' | 'category' | 'owner_key'>>,
): Promise<boolean> {
  const { error } = await supabase.from('transactions').update(patch).eq('id', id);
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
