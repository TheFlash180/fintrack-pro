import { describe, expect, it } from 'vitest';
import { buildBatchHashes } from '../data';
import { dedupeHash } from '../dedupe';
import type { DraftTx } from '../types';

function draft(overrides: Partial<DraftTx> = {}): DraftTx {
  return {
    tx_date: '2026-04-01',
    description: 'Debit Order Fee',
    amount: -3,
    category: 'Bank Fees',
    owner_key: 'rickus',
    ...overrides,
  };
}

describe('buildBatchHashes', () => {
  it('suffixes identical same-owner rows _2, _3… in order', async () => {
    // Four identical "Debit Order Fee -3.00" rows on one date is a normal
    // Capitec day — the suffix scheme is load-bearing for real imports.
    const hashes = await buildBatchHashes([draft(), draft(), draft(), draft()]);
    const base = await dedupeHash('2026-04-01', -3, 'Debit Order Fee');
    expect(hashes).toEqual([base, `${base}_2`, `${base}_3`, `${base}_4`]);
  });

  it('does not suffix across different owners', async () => {
    const hashes = await buildBatchHashes([
      draft({ owner_key: 'rickus' }),
      draft({ owner_key: 'anjone' }),
    ]);
    const base = await dedupeHash('2026-04-01', -3, 'Debit Order Fee');
    expect(hashes).toEqual([base, base]);
  });

  it('leaves distinct rows unsuffixed', async () => {
    const hashes = await buildBatchHashes([
      draft(),
      draft({ amount: -5 }),
      draft({ description: 'Monthly Account Admin Fee' }),
    ]);
    expect(new Set(hashes).size).toBe(3);
    for (const h of hashes) expect(h).not.toMatch(/_\d+$/);
  });

  it('shifts suffixes when a row is removed — why confirm() must recompute flags', async () => {
    const three = await buildBatchHashes([draft(), draft(), draft()]);
    const two = await buildBatchHashes([draft(), draft()]);
    // Removing the middle row moves the third row onto the second's hash:
    expect(two[1]).toBe(three[1]);
    expect(two[1]).not.toBe(three[2]);
  });
});
