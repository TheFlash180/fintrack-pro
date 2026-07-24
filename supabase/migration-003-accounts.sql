-- Migration 003: multi-account overview.
--
-- Until now FinTrack tracked one undifferentiated transaction stream per
-- person. Rickus's money actually lives across five accounts, so this adds an
-- accounts dimension plus a transfer flag, giving a full net-worth overview and
-- letting inter-account moves (card repayments, savings top-ups) stop being
-- double-counted as spend.
--
-- Same trust boundary as everything else: logged-in household member = full
-- access. Safe to run once against the shared project; the frontend also
-- tolerates running before this migration (it falls back to the old columns).

create table fintrack_accounts (
  key text primary key,                         -- 'capitec-savings', 'nuwe-foon', …
  owner_key text not null check (owner_key in ('rickus','anjone')),
  name text not null,                           -- full display name
  short_name text not null,                     -- compact label for tiles
  kind text not null check (kind in ('current','savings','credit')),
  is_liability boolean not null default false,  -- credit card = money owed
  external_ref text,                            -- bank account / reference number
  sort_order int not null default 0,
  stated_balance numeric,                       -- user-reported balance (net-worth source of truth)
  balance_as_of timestamptz,                    -- when that balance was true
  opening_balance numeric,                      -- balance just before opening_date (reconciliation anchor)
  opening_date date                             -- reconcile only sums transactions on/after this date
);

alter table fintrack_accounts enable row level security;
create policy "fintrack users" on fintrack_accounts
  for all to authenticated using (true) with check (true);

-- Tag every transaction with its account, and flag inter-account transfers.
alter table transactions
  add column account_key text references fintrack_accounts(key),
  add column is_transfer boolean not null default false;
create index transactions_account_idx on transactions (account_key);

-- Seed the real accounts. Stated balances are Rickus's figures at 2026-07-24
-- 13:22 SAST; opening anchors are derived from the running balance on the
-- latest statements (Capitec exports carry a Balance column, Discovery exports
-- don't — so those reconcile on movement totals only).
insert into fintrack_accounts
  (key, owner_key, name, short_name, kind, is_liability, external_ref, sort_order,
   stated_balance, balance_as_of, opening_balance, opening_date) values
  ('capitec-savings','rickus','Capitec Savings','Capitec','current', false,'1466139852',1,
     87860.58, '2026-07-24T13:22:00+02:00', 93848.67, '2026-06-01'),
  ('nuwe-foon','rickus','Nuwe Foon · New Phone','New Phone','savings', false,'2497642482',2,
     5046.69, '2026-07-24T13:22:00+02:00', 2003.07, '2026-04-01'),
  ('nuwe-kar','rickus','Nuwe Kar · New Car','New Car','savings', false,'2541151450',3,
     15113.21, '2026-07-24T13:22:00+02:00', 0, '2026-05-11'),
  ('disc-savings','rickus','Discovery 32-Day Savings','Disc Savings','savings', false,'14155320856',4,
     112684.57, '2026-07-24T13:22:00+02:00', null, null),
  ('disc-cc','rickus','Discovery Credit Card','Disc Card','credit', true,'15278991189',5,
     23983.13, '2026-07-24T13:22:00+02:00', null, null),
  ('fnb-anjone','anjone','FNB Account','FNB','current', false, null, 1,
     null, null, null, null);

-- Existing history belongs to each owner's main account. Non-destructive: it
-- only fills the new column, it does not touch amounts, categories or the
-- transfer flag, so current dashboards are unchanged.
update transactions set account_key = 'capitec-savings'
  where owner_key = 'rickus' and account_key is null;
update transactions set account_key = 'fnb-anjone'
  where owner_key = 'anjone' and account_key is null;

-- NOTE: existing rows keep is_transfer = false. Historically, credit-card fuel
-- was tracked as the lump "Credit Card" repayment out of Capitec, so it still
-- shows as spend. Once the Discovery card statement is imported (which itemises
-- fuel/airtime and flags the Capitec repayments as transfers), you may want to
-- retire that double count — do it deliberately then, not automatically here.
