# Working on FinTrack Pro

Household finance for two people (Rickus and Anjoné), fed by Capitec CSV
exports and FNB PDF statements. Part of the same family as
[claude-ecosystem](https://github.com/TheFlash180/claude-ecosystem) and
**shares its Supabase project** (`objkdeagyltvgcuxsnxu`) — a schema change here
lands in the same database as every app in that repo.

## The security model is deliberate

`transactions`, `budgets`, `profiles`, `fintrack_settings` and
`fintrack_accounts` all use `for all to authenticated using (true)`. **That is
not a hole and should not be "fixed" to per-owner isolation.**

`fintrack_allowlist` plus the `on_auth_fintrack_user_created` trigger on
`auth.users` reject any signup whose email is not on a two-entry allowlist. So
"authenticated" means "one of the two of us", which is the intended trust
boundary for a shared household ledger. The Trollip dashboard deliberately
shows both people's transactions — per-owner RLS would break it.

That trigger is load-bearing for **baby-logger in the other repo too**, whose
tables use "any authenticated user" policies. Do not drop or weaken it.

This does block multi-tenancy. If the app is ever sold or shared beyond the
household, the RLS has to be reworked at that point — not before.

## Importing is the part with teeth

Everything below exists because it went wrong once.

**Duplicate protection** is a SHA-256 of `date|amount.toFixed(2)|normalised
description`, stored in `dedupe_hash` with a partial unique index on
`(owner_key, dedupe_hash)`. Genuinely repeated rows in one statement — four
identical R3 debit-order fees on the same day — get `_2`, `_3`, `_4` suffixes.
`buildBatchHashes` must run over the **full** review list, not a filtered
subset, or a suffix shifts and collides with an already-imported twin.

**A failed duplicate check throws.** It must never read as "no duplicates
found", or a re-import silently doubles everything.

**Pending rows are skipped, in both the CSV and the statement parser.** Capitec
prefixes them `(Pending)`. They settle within days under a *different
description and often a different date* — `(Pending) KFC Johannesburg` becomes
`KFC Johannesburg` — so the hash will not match and the settled version imports
as a second transaction. This already double-counted a R64.99 Steam purchase.

**Categorisation learns from history.** Priority is: how you filed that merchant
last time → the bank's own category column → the keyword rules. Matching is on
`merchantKey()`, which strips the transaction id, card number and mandate
reference, and drops everything before the last `": "` — because the bank also
changes the *prefix* (the same Old Mutual debit moved from `Eft Debit Order` to
`DebiCheck Debit Order` mid-2026). `Uncategorised` and `Transfer` are never
learned from.

**Transfers are not spending.** `isTransferDescription` matches structurally —
`Banking App Transfer to ` is Capitec's wording for moving money between your
own accounts, so any future savings pot is caught without editing a list. It
deliberately does not match bare "transfer": `Payment Received: Absa Bank
Reinardt Transfer` is real income.

## Practical

- `npm run build` is what CI runs; deploy is on push to `main`, no PR checks.
- Tests are vitest in `src/lib/__tests__/`. Keep logic in `src/lib/` free of
  React so it stays testable.
- Pure-logic modules: `csv`, `statementParse`, `pdfExtract`, `dedupe`,
  `categorize`, `merchant`, `transfers`, `aggregate`, `format`.
- The dev container's proxy blocks `supabase.co`, so use the Supabase MCP tools
  for data rather than the REST API.
- To screenshot: build with dummy `VITE_SUPABASE_*` values, seed a fake session
  into `localStorage` under `sb-objkdeagyltvgcuxsnxu-auth-token`, and intercept
  `**/rest/v1/**` with Playwright.

## History worth knowing

The net-worth / accounts-balance section was removed in #21. The
`fintrack_accounts` table stays — imports use it to tag which account a
transaction came from — and `stated_balance` / `balance_as_of` /
`is_liability` are left in place rather than dropped, so nothing is lost if the
idea returns.
