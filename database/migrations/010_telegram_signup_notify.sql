-- Migration 010: Telegram notification on new Supabase Auth user (fire-and-forget).
-- Idempotent: safe to run multiple times (OR REPLACE / IF NOT EXISTS / DROP+CREATE with checks).
--
-- What it does: an AFTER INSERT trigger on auth.users relays one signed event
-- per newly created auth user to the `notify-signup` Edge Function via pg_net
-- (async queue — never blocks signup). The Edge Function verifies the event
-- and calls the Telegram Bot API. Works for signups from any client
-- (frontend, admin API, dashboard-created users) because it reacts to the
-- auth.users row itself, not to any application route.
--
-- WHY THIS SHAPE (see README §5c): calling the Telegram API directly from
-- Postgres would store the bot token inside the pg_net request-queue URL.
-- Instead Postgres holds NO Telegram credentials at all: it signs a minimal
-- event with a Vault-held HMAC key, and only the Edge Function (server
-- secrets) ever touches the Telegram API. No static token or API key ever
-- travels through pg_net, and there is no public unauthenticated endpoint.
--
-- SECRETS (Vault ONLY, names below — values never in repo/SQL; insert manually
-- as the database owner via Supabase Dashboard -> SQL editor):
--   select vault.create_secret('<RANDOM_32B_HEX>', 'notify_signing_secret');
--   select vault.create_secret('<EDGE_FUNCTION_URL>', 'notify_function_url');
-- The SAME signing-secret value must also be set as the Edge Function secret
-- NOTIFY_SIGNING_SECRET (`supabase secrets set`). Generate with:
--   openssl rand -hex 32
-- `notify_function_url` is deployment config, not a secret, e.g.
-- https://<project-ref>.supabase.co/functions/v1/notify-signup
--
-- Prerequisites (Supabase Dashboard -> Database -> Extensions, then verify):
--   1. pg_net extension (async HTTP from Postgres; never blocks signup).
--   2. supabase_vault extension (server-side secret storage).
-- Without either extension, without the Vault entries, or on ANY error, the
-- trigger is a silent no-op: signup always succeeds, nothing is sent.
--
-- Failure isolation: pg_net queues the request asynchronously, and EVERYTHING
-- below is wrapped so that any Vault/network/SQL failure returns NEW
-- unchanged. A notification problem can NEVER abort or roll back registration.
--
-- Dedup: the trigger fires exactly once per auth.users row insert. Re-logins,
-- email confirmations, and profile edits are UPDATEs and never re-fire it.
-- Re-signup with an unconfirmed address reuses the existing auth user
-- (no new row), so no second event is produced. The Edge Function additionally
-- enforces nonce uniqueness + a ±5 minute timestamp window (replay-safe).
--
-- Event payload (minimal, no PII beyond the account UUID which the operator
-- needs for correlation; no email, no statistics):
--   { user_id, created_minute (UTC, minute precision), email_confirmed,
--     nonce (fresh UUID per event), ts (unix seconds) }
-- Signed canonical string (identical construction in Edge Function):
--   v1.<ts>.<user_id>.<created_minute>.<0|1>.<nonce>
-- Header: X-Signature: v1=<hex HMAC-SHA256>, X-Timestamp: <ts>.
-- Email confirmation is reported honestly from the auth row itself
-- (confirmed_at IS NULL at normal signup time).

-- Pure-SQL HMAC-SHA256 (RFC 4231), no pgcrypto dependency: PGlite, Postgres
-- core functions only (convert_to, get_byte/set_byte, sha256, repeat, decode).
-- Byte-identical to crypto.createHmac('sha256') / WebCrypto HMAC-SHA256;
-- verified against the RFC 4231 test vector in database/telegram-signup-notify.test.ts.
--
-- Version-proofing: PostgreSQL ≤17 returns text from sha256(), PostgreSQL 18+
-- returns bytea. The helper below normalizes explicitly (probed, not assumed),
-- so HMAC output is identical on Supabase Postgres and on PGlite alike.
create or replace function public.telegram_sha256_hex(p_data bytea)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if pg_typeof(sha256(''::bytea)) = 'bytea'::regtype then
    return encode(sha256(p_data), 'hex');
  else
    return sha256(p_data)::text;
  end if;
end;
$$;

create or replace function public.telegram_hmac_sha256_hex(p_key text, p_data text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  k bytea := convert_to(p_key, 'UTF8');
  m bytea := convert_to(p_data, 'UTF8');
  kb bytea;
  ob bytea := ''::bytea;
  ib bytea := ''::bytea;
  i int;
begin
  if length(k) > 64 then
    k := decode(public.telegram_sha256_hex(k), 'hex');
  end if;
  kb := k || decode(repeat('00', 64 - length(k)), 'hex');
  for i in 0..63 loop
    ob := ob || set_byte('\x00'::bytea, 0, get_byte(kb, i) # 92);
    ib := ib || set_byte('\x00'::bytea, 0, get_byte(kb, i) # 54);
  end loop;
  return public.telegram_sha256_hex(ob || decode(public.telegram_sha256_hex(ib || m), 'hex'));
end;
$$;

-- One-shot nonces for Edge Function replay protection (service-role only;
-- intentionally no RLS policies, same posture as provider_events/fraud_flags).
create table if not exists public.telegram_notify_nonces(
  nonce text primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_notify_nonces enable row level security;

create or replace function public.notify_telegram_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_function_url text;
  v_ts bigint;
  v_nonce text;
  v_minute text;
  v_confirmed text;
  v_canonical text;
  v_sig text;
begin
  -- Secrets/config by NAME only; values live exclusively in Vault (never in repo/SQL).
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_signing_secret' limit 1;
  select decrypted_secret into v_function_url from vault.decrypted_secrets where name = 'notify_function_url' limit 1;
  if v_secret is null or v_secret = '' or v_function_url is null or v_function_url = '' then
    -- Not configured yet: stay silent, signup unaffected.
    return new;
  end if;

  v_ts := extract(epoch from now())::bigint;
  v_nonce := gen_random_uuid()::text;
  v_minute := to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI');
  -- At INSERT time a normal signup is unconfirmed; never claim otherwise.
  v_confirmed := case when new.confirmed_at is null then '0' else '1' end;

  v_canonical := 'v1.' || v_ts::text || '.' || new.id::text
    || '.' || v_minute || '.' || v_confirmed || '.' || v_nonce;
  v_sig := public.telegram_hmac_sha256_hex(v_secret, v_canonical);

  -- Async queue insert: returns immediately, never blocks the signup
  -- transaction on Edge Function latency or outage. No static credential:
  -- only the fresh HMAC signature travels with this single event.
  perform net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Signature', 'v1=' || v_sig,
      'X-Timestamp', v_ts::text
    ),
    body := jsonb_build_object(
      'user_id', new.id::text,
      'created_minute', v_minute,
      'email_confirmed', v_confirmed = '1',
      'nonce', v_nonce,
      'ts', v_ts
    )
  );
  return new;
exception
  when others then
    -- Vault/pg_net/SQL must never break signup (follows the defensive
    -- pattern of migration 003): swallow and let the auth user exist.
    return new;
end;
$$;

drop trigger if exists on_auth_user_telegram_notify on auth.users;
create trigger on_auth_user_telegram_notify
  after insert on auth.users
  for each row execute function public.notify_telegram_signup();

-- These functions need no caller privileges (triggers fire with definer
-- rights, the helpers are called internally only); revoke direct
-- execution explicitly so none can be invoked as an RPC.
revoke all on function public.notify_telegram_signup() from public, anon, authenticated;
revoke all on function public.telegram_hmac_sha256_hex(text, text) from public, anon, authenticated;
revoke all on function public.telegram_sha256_hex(bytea) from public, anon, authenticated;
