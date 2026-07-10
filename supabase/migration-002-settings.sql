-- Migration 002: dashboard settings (category lists) move from per-device
-- localStorage into the shared database, so both users and all devices see
-- the same categories — and a category rename can't leave one phone showing
-- transactions in a category its local settings don't know about.

create table fintrack_settings (
  dash_key text primary key check (dash_key in ('rickus','anjone','trollip')),
  categories jsonb not null,
  fixed_categories jsonb not null,
  updated_at timestamptz not null default now()
);

alter table fintrack_settings enable row level security;

-- Same trust boundary as everything else: logged in = full access.
create policy "fintrack users" on fintrack_settings
  for all to authenticated using (true) with check (true);
