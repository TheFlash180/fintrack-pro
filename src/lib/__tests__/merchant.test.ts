import { describe, expect, it } from 'vitest';
import { categorizeLearned, learnCategories, learnedCategory, merchantKey } from '../merchant';
import type { Tx } from '../types';

function tx(tx_date: string, description: string, category: string): Tx {
  return {
    id: `${tx_date}-${description}`,
    owner_key: 'rickus',
    tx_date,
    description,
    amount: -100,
    category,
    source: 'csv',
    dedupe_hash: null,
  } as Tx;
}

describe('merchantKey', () => {
  it('ignores the card number, which differs per card on the same account', () => {
    // These two are the same shop, paid on the two different cards.
    expect(merchantKey('Pick n Pay Randburg (Card 9775)'))
      .toBe(merchantKey('Pick n Pay Randburg (Card 4481)'));
  });

  it('ignores the transaction id, which changes every month', () => {
    expect(merchantKey('Eft Debit Order (3273521101): Old Mutual (0000ECFC4A)'))
      .toBe(merchantKey('Eft Debit Order (3201383303): Old Mutual (0000ECFC4A)'));
  });

  it('survives the bank changing the debit-order wording', () => {
    // Real case: the same Old Mutual debit arrived as "Eft Debit Order" until
    // July and "DebiCheck Debit Order" from 31 July. Keying on the prefix
    // would have lost the category exactly when the wording changed.
    expect(merchantKey('Eft Debit Order (3273521101): Old Mutual (0000ECFC4A)'))
      .toBe(merchantKey('DebiCheck Debit Order (3327117064): Old Mutual (0000ECFC4A)'));
  });

  it('keeps genuinely different merchants apart', () => {
    expect(merchantKey('Online Purchase: Takealot Cape Town (Card 4481)'))
      .not.toBe(merchantKey('Online Purchase: Playtomic Cape Town (Card 4481)'));
    expect(merchantKey('Banking App External Payment: Maria Domestic'))
      .not.toBe(merchantKey('Banking App External Payment: Fuel'));
  });

  it('handles a description with no prefix at all', () => {
    expect(merchantKey('Debit Order Fee')).toBe('debit order fee');
  });

  it('is empty for nothing, rather than throwing', () => {
    expect(merchantKey('')).toBe('');
    expect(merchantKey(null)).toBe('');
    expect(merchantKey(undefined)).toBe('');
  });
});

describe('learnCategories', () => {
  it('remembers the category a merchant was last filed under', () => {
    const learned = learnCategories([
      tx('2026-06-19', 'Recurring Card Purchase: Netflix Amsterdam (Card 4481)', 'Netflix'),
    ]);
    expect(learnedCategory('Recurring Card Purchase: Netflix Amsterdam (Card 4481)', learned))
      .toBe('Netflix');
  });

  it('prefers the most recent decision, not the most frequent', () => {
    // Changing your mind should take effect next import, not be outvoted by a
    // year of the previous answer.
    const learned = learnCategories([
      tx('2026-01-19', 'Recurring Card Purchase: Netflix Amsterdam', 'Subscriptions'),
      tx('2026-02-19', 'Recurring Card Purchase: Netflix Amsterdam', 'Subscriptions'),
      tx('2026-06-19', 'Recurring Card Purchase: Netflix Amsterdam', 'Netflix'),
    ]);
    expect(learnedCategory('Recurring Card Purchase: Netflix Amsterdam', learned))
      .toBe('Netflix');
  });

  it('never learns from Uncategorised', () => {
    // One unreviewed import must not teach the app to keep getting it wrong.
    const learned = learnCategories([
      tx('2026-01-01', 'Perfectwaterdouglasd Douglasdale', 'Groceries'),
      tx('2026-06-01', 'Perfectwaterdouglasd Douglasdale', 'Uncategorised'),
    ]);
    expect(learnedCategory('Perfectwaterdouglasd Douglasdale', learned)).toBe('Groceries');
  });

  it('never learns from the Transfer label', () => {
    const learned = learnCategories([
      tx('2026-07-01', 'Banking App Transfer to Nuwe Kar: Transfer', 'Transfer'),
    ]);
    expect(learnedCategory('Banking App Transfer to Nuwe Kar: Transfer', learned)).toBeNull();
  });

  it('returns null for a merchant it has never seen', () => {
    const learned = learnCategories([tx('2026-01-01', 'Spur Johannesburg', 'Eating Out')]);
    expect(learnedCategory('Some Brand New Shop', learned)).toBeNull();
  });
});

describe('categorizeLearned', () => {
  const learned = learnCategories([
    tx('2026-07-01', 'Recurring Immediate Payment (25246062): Kar Versekering', 'Car Insurance'),
    tx('2026-07-01', 'Eft Debit Order (3273521101): Old Mutual (0000ECFC4A)', 'Old Mutual'),
  ]);

  it('keeps the category you chose over the one the rules would derive', () => {
    // The keyword rule says "versek" → Insurance. You said Car Insurance.
    expect(categorizeLearned(
      'Recurring Immediate Payment (25246062): Kar Versekering', undefined, learned,
    )).toBe('Car Insurance');
  });

  it('keeps your choice even when the bank supplies its own category', () => {
    // "life insurance" maps to Insurance, but a past decision outranks it —
    // otherwise the bank's generic column silently undoes your work.
    expect(categorizeLearned(
      'Eft Debit Order (3273521101): Old Mutual (0000ECFC4A)', 'life insurance', learned,
    )).toBe('Old Mutual');
  });

  it('falls back to the bank category for an unseen merchant', () => {
    expect(categorizeLearned('Some New Doctor', 'pharmacy', learned)).toBe('Medical');
  });

  it('falls back to the keyword rules when there is nothing else', () => {
    expect(categorizeLearned('Spur Johannesburg (Card 9775)', undefined, learned))
      .toBe('Eating Out');
  });

  it('behaves like the plain categoriser when nothing has been learned yet', () => {
    expect(categorizeLearned('Spur Johannesburg', undefined, undefined)).toBe('Eating Out');
    expect(categorizeLearned('Spur Johannesburg', undefined, new Map())).toBe('Eating Out');
  });
});
