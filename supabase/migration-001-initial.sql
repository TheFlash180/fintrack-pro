-- FinTrack Pro: household finance for two users.
-- (Schema of record — already applied to the shared Supabase project.)
-- Security model: repo/anon-key are public; RLS restricts everything to
-- authenticated users, and ONLY allowlisted emails can ever authenticate
-- (enforced by a trigger on auth.users, independent of dashboard settings).

create table fintrack_allowlist (
  email text primary key,
  owner_key text not null check (owner_key in ('rickus','anjone')),
  display_name text not null
);
alter table fintrack_allowlist enable row level security;
-- no policies: invisible through the API; only definer functions/triggers read it

insert into fintrack_allowlist (email, owner_key, display_name)
values ('rickust18@gmail.com', 'rickus', 'Rickus');
-- Anjoné's row is added once her email is known:
-- insert into fintrack_allowlist values ('her@email', 'anjone', 'Anjoné');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  owner_key text not null check (owner_key in ('rickus','anjone'))
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null check (owner_key in ('rickus','anjone')),
  tx_date date not null,
  description text,
  amount numeric not null,          -- positive = income, negative = expense
  category text not null default 'Uncategorised',
  source text not null default 'manual',  -- manual | csv | pdf | paste
  dedupe_hash text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create unique index transactions_dedupe_idx
  on transactions (owner_key, dedupe_hash) where dedupe_hash is not null;
create index transactions_date_idx on transactions (tx_date);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  monthly_amount numeric not null,
  effective_from date not null,  -- applies from this month until a newer row exists
  created_at timestamptz default now(),
  unique (category, effective_from)
);

alter table profiles enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- Trust boundary: "logged in as one of the two of us" = full access.
create policy "fintrack users" on profiles
  for all to authenticated using (true) with check (true);
create policy "fintrack users" on transactions
  for all to authenticated using (true) with check (true);
create policy "fintrack users" on budgets
  for all to authenticated using (true) with check (true);

-- Reject any signup not on the allowlist; auto-provision the profile for
-- those that are. Works for both API signups and dashboard-created users.
create or replace function handle_new_fintrack_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v fintrack_allowlist%rowtype;
begin
  select * into v from fintrack_allowlist where lower(email) = lower(new.email);
  if v.email is null then
    raise exception 'Signups are restricted to household members';
  end if;
  insert into profiles (id, display_name, owner_key)
  values (new.id, v.display_name, v.owner_key)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_fintrack_user_created
  after insert on auth.users
  for each row execute function handle_new_fintrack_user();
