-- Frearn / PostgreSQL-ready schema (Supabase compatible)
-- Money: NUMERIC(12,2) or BIGINT cents. Ledger is immutable; balances derived.
-- TODO(legal/security): review retention + RLS policies before production.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  country char(2) not null,
  date_of_birth date,
  gender text check (gender in ('female','male','non_binary','prefer_not_to_say','other')),
  employment_status text,
  education text,
  household_size int check (household_size >= 1),
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_offer_id text not null,
  title text not null,
  description text not null default '',
  category text not null check (category in ('surveys','offers','games','research','app-testing','microtasks')),
  country text not null default 'GLOBAL',
  reward_cents int not null check (reward_cents >= 0),
  publisher_revenue_cents int not null default 0 check (publisher_revenue_cents >= 0),
  estimated_minutes int not null check (estimated_minutes > 0),
  status text not null default 'active' check (status in ('active','paused','expired')),
  external_url text not null default '',
  created_at timestamptz not null default now(),
  unique (provider, provider_offer_id)
);

-- Immutable ledger. Never UPDATE balances; INSERT new rows (incl. reversals).
create table if not exists ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('survey_reward','offer_reward','adjustment','withdrawal','reversal')),
  status text not null default 'pending' check (status in ('pending','confirmed','reversed')),
  amount_cents int not null,
  description text not null default '',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  provider text,
  provider_transaction_id text,
  publisher_revenue_cents int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (idempotency_key)
);

-- DB-level idempotency for provider callbacks (concurrent duplicates safe).
-- Composite includes `type` so exactly one reward + one reversal may coexist
-- per provider transaction; same-type duplicates still conflict.
-- (See migration 004: an earlier two-column variant silently blocked reversals.)
create unique index if not exists ledger_transactions_provider_txn_uidx
  on ledger_transactions (provider, provider_transaction_id, type)
  where provider_transaction_id is not null;

create table if not exists withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  method text not null,
  destination text not null,
  status text not null default 'requested'
    check (status in ('requested','reviewing','approved','processing','paid','rejected')),
  created_at timestamptz not null default now()
);

-- Provider callbacks with idempotency: same callback cannot reward twice.
create table if not exists provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  user_id uuid references profiles(id) on delete set null,
  external_offer_id text,
  event_type text not null,
  publisher_revenue_cents int not null default 0,
  user_reward_cents int not null default 0,
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  error text,
  unique (provider, external_event_id)
);

create table if not exists fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  severity text not null default 'low' check (severity in ('low','medium','high')),
  registration_ip_country char(2),
  current_ip_country char(2),
  account_country char(2),
  device_hash text,
  risk_score int not null default 0 check (risk_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Signup trigger + Row Level Security live in
-- database/migrations/002_cpx_provider.sql — run that file right after this one
-- (both for fresh installs and existing databases).
