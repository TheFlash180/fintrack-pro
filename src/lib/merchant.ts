// Learning categorisation from what you have already decided.
//
// The keyword rules in categorize.ts are a cold start: they know "old mutual"
// is insurance, but not that you keep it in its own "Old Mutual" category, or
// that "Kar Versekering" is "Car Insurance" to you rather than plain
// "Insurance". Every import re-ran those rules from scratch, so a category you
// fixed by hand in June came back wrong in July — the same debit order ends up
// split across two categories and the breakdown stops adding up.
//
// So: before falling back to the rules, look at how this merchant was filed
// last time.
import { categorizeWithHint } from './categorize';
import type { Tx } from './types';

/** The merchant part of a bank description, stable across months.
 *
 *  Bank lines carry three kinds of noise that change every time: a
 *  transaction id, a card number, and a mandate reference. They also change
 *  PREFIX — the same Old Mutual debit arrived as "Eft Debit Order (…)" until
 *  July and "DebiCheck Debit Order (…)" after — so the prefix cannot be part
 *  of the key either. What is left is the merchant itself, which is the thing
 *  a category actually belongs to. */
export function merchantKey(description: string | null | undefined): string {
  if (!description) return '';

  let s = description
    // "(Card 4481)", "(1234567)", "(F903F98DD6)" — ids and references.
    .replace(/\(card\s*\d+\)/gi, ' ')
    .replace(/\([0-9A-Z]{4,}\)/g, ' ')
    .replace(/\(\d+\)/g, ' ');

  // Everything before the last ": " is the bank's own wording for HOW the
  // money moved ("Recurring Card Purchase", "Eft Debit Order"). The merchant
  // is what follows.
  const colon = s.lastIndexOf(': ');
  if (colon !== -1) s = s.slice(colon + 2);

  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Categories that carry no decision, so they must never be learned from —
 *  otherwise one unreviewed import teaches the app to keep getting it wrong. */
const NOT_A_DECISION = new Set(['', 'uncategorised', 'uncategorized', 'transfer']);

/** merchantKey → the category you filed it under most recently.
 *
 *  Most recent wins rather than most frequent: changing your mind should take
 *  effect from the next import, not be outvoted by a year of the old answer. */
export function learnCategories(txs: Tx[]): Map<string, string> {
  const seen = new Map<string, { category: string; at: string }>();

  for (const t of txs) {
    const category = (t.category ?? '').trim();
    if (NOT_A_DECISION.has(category.toLowerCase())) continue;
    const key = merchantKey(t.description);
    if (key === '') continue;

    const prev = seen.get(key);
    // tx_date is yyyy-mm-dd, so a string compare is a date compare.
    if (!prev || t.tx_date > prev.at) seen.set(key, { category, at: t.tx_date });
  }

  const out = new Map<string, string>();
  for (const [key, v] of seen) out.set(key, v.category);
  return out;
}

/** What this merchant was filed under before, if anything. */
export function learnedCategory(
  description: string,
  learned: Map<string, string> | undefined,
): string | null {
  if (!learned) return null;
  return learned.get(merchantKey(description)) ?? null;
}

/** The full picture, in priority order:
 *
 *   1. how you filed this merchant last time
 *   2. the bank's own category column
 *   3. the keyword rules
 *
 *  A past decision outranks both of the others on purpose. The rules and the
 *  bank column only know generic buckets; if Netflix has been moved out of
 *  "Subscriptions" onto its own line, re-deriving "Subscriptions" every month
 *  is not a fresh guess — it is undoing work already done. */
export function categorizeLearned(
  description: string,
  bankCategory: string | undefined,
  learned: Map<string, string> | undefined,
): string {
  const previous = learnedCategory(description, learned);
  if (previous) return previous;
  return categorizeWithHint(description, bankCategory);
}
