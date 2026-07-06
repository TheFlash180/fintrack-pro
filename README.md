# FinTrack Pro

Personal finance PWA for the Trollip household — two users, zero running cost.
Vite + React + TypeScript, Supabase (Postgres + Auth, free tier), GitHub Pages
hosting, Recharts dashboards. Installable on phone and desktop.

**Live:** `https://<username>.github.io/fintrack-pro/`

## What it does

- **Import bank statements with no paid APIs.** Both banks export CSV
  (recommended): FNB's single signed-amount column and Capitec's split
  Money In / Money Out / Fee columns (plus Capitec's own category column,
  used as a categorisation hint) are both auto-detected. PDF import runs
  client-side with pdf.js (statements never leave the browser) for both
  Capitec and FNB's Afrikaans statement layout — handles "Kt"/"Dt" suffixes,
  year-less dates resolved from the statement period header, and strips the
  card-reference noise FNB appends to descriptions. A Paste tab (CSV or JSON)
  covers anything else. Manual add/edit/delete always available.
- **Review before saving.** Every import lands on an editable review table —
  fix dates/amounts/categories/owner, delete rows, add rows. Nothing writes to
  the database until "Confirm import".
- **No double-counting.** Each transaction gets a SHA-256 hash of
  date+amount+description; re-uploading the same statement flags rows as
  already imported and the database unique index skips them regardless.
- **Auto-categorisation** by SA-merchant keyword rules
  ([src/lib/categorize.ts](src/lib/categorize.ts) — edit freely).
- **Three dashboards** — Rickus, Anjoné, Trollip (household) — each with
  income/expenses/net tiles, income-vs-expenses chart, ranked category spend,
  and recent transactions; month picker with full-history browsing and an
  all-time view.
- **Household extras:** 12-month comparison with month-over-month deltas and a
  prominent "spending up/down vs last month" callout, plus per-category monthly
  budgets with progress bars (carry forward until changed).

## Security model

The repo and the Supabase anon key are public (GitHub Pages requirement) —
that's fine and expected. The boundaries that matter:

1. **RLS on every table**: only `authenticated` users can touch data.
2. **Signups are restricted at the database level**: a trigger on `auth.users`
   rejects any email not in the `fintrack_allowlist` table, so nobody can
   self-register even with the public anon key.
3. Belt-and-braces: disable public signups in the dashboard too
   (Authentication → Sign In / Up → toggle "Allow new users to sign up" off).

## Supabase setup

Schema lives in [supabase/migration-001-initial.sql](supabase/migration-001-initial.sql)
(tables, RLS, allowlist trigger). Then:

1. Add both household emails to the allowlist (one insert each).
2. Create the two users: Dashboard → Authentication → Users → **Add user** →
   email + password, "Auto Confirm User" on. The trigger auto-creates each
   `profiles` row with the right owner identity.
3. Disable public signups (see above).

## GitHub Pages deploy

Repo → Settings → Pages → Source: **GitHub Actions**, plus two Actions secrets:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Every push to `main` runs the
tests, builds, and deploys.

## Local dev

```powershell
npm install
copy .env.example .env.local    # fill in Supabase URL + anon key
npm run dev                     # http://localhost:5173/fintrack-pro/
npm test                        # parser/dedupe/categoriser unit tests
npm run build                   # exactly what CI runs
```

Sample fixtures for the import paths are in
[src/lib/\_\_tests\_\_/fixtures/](src/lib/__tests__/fixtures/) — an anonymised
Capitec statement excerpt (as extracted text lines) and an FNB CSV.

### A note on the PDF parsers

Both profiles are calibrated against real Capitec and FNB statements
(including FNB's Afrikaans layout and its occasional rows where the PDF text
layer drops the description entirely — those still parse with a placeholder
description, editable on the review screen). If a future statement layout
changes and rows come out wrong, review screen catches it (nothing saves
unreviewed) and the Paste tab is the immediate workaround; fixing a profile is
a small edit in [src/lib/statementParse.ts](src/lib/statementParse.ts).

## Out of scope for v1 (by design)

AI-powered parsing (zero-cost constraint), realtime live sync (fetch-on-load is
fine), Rickus's 4-year Excel history migration (follow-up task), and Anjoné's
detailed budget methodology (schema already supports extending budgets).
