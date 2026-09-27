-- Migration 002: CPX provider integration + Row Level Security
-- Idempotent: safe to run multiple times. Run AFTER database/schema.sql.
-- Requires: Supabase Postgres (uses auth.uid()).

-- ---------------------------------------------------------------- ledger ---
alter table if exists ledger_transactions
  add column if not exists provider text,
  add column if not exists provider_transaction_id text,
  add column if not exists publisher_revenue_cents int not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- DB-level idempotency: the same provider transaction can never credit twice,
-- even under concurrent duplicate callbacks.
create unique index if not exists ledger_transactions_provider_txn_uidx
  on ledger_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;

-- ------------------------------------------------------- provider events ---
alter table if exists provider_events
  add column if not exists processing_status text not null default 'received',
  add column if not exists error text;

-- ------------------------------------------------------- signup trigger ---
-- Creates a public.profiles row for every new auth user.
-- Country comes from sign-up user_metadata (registration form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text := nullif((new.raw_user_meta_data ->> 'country'), '');
begin
  insert into public.profiles (id, email, country)
  values (new.id, new.email, coalesce(v_country, 'XX'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- RLS ---
-- Principle: users read their own data; ONLY service-role (server callbacks)
-- creates rewards, events, reversals. No INSERT/UPDATE/DELETE policies for
-- normal users on financial tables.

alter table if exists profiles enable row level security;
alter table if exists ledger_transactions enable row level security;
alter table if exists opportunities enable row level security;
alter table if exists withdrawal_requests enable row level security;
alter table if exists provider_events enable row level security;
alter table if exists fraud_flags enable row level security;
alter table if exists waitlist enable row level security;

-- profiles: read + update own row only
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ledger: read own only. NO insert/update/delete for anon/authenticated —
-- rewards/reversals are created exclusively by server callbacks (service role).
drop policy if exists "ledger_select_own" on ledger_transactions;
create policy "ledger_select_own" on ledger_transactions
  for select to authenticated using (auth.uid() = user_id);

-- opportunities: readable by signed-in users (internal catalog, never shown publicly with provider keys)
drop policy if exists "opportunities_select_auth" on opportunities;
create policy "opportunities_select_auth" on opportunities
  for select to authenticated using (true);

-- withdrawals: read own only (creation happens in a future reviewed payout flow)
drop policy if exists "withdrawals_select_own" on withdrawal_requests;
create policy "withdrawals_select_own" on withdrawal_requests
  for select to authenticated using (auth.uid() = user_id);

-- provider_events / fraud_flags: NO policies for anon/authenticated.
-- Service role bypasses RLS. Raw callback payloads are never user-readable.

-- waitlist: anyone may insert their email; nobody may read the list.
drop policy if exists "waitlist_insert_any" on waitlist;
create policy "waitlist_insert_any" on waitlist
  for insert to anon, authenticated with check (true);
