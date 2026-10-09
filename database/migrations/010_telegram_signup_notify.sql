-- Migration 010: Telegram notification on new Supabase Auth user (fire-and-forget).
-- Idempotent: safe to run multiple times (OR REPLACE / DROP + CREATE with checks).
--
-- What it does: an AFTER INSERT trigger on auth.users sends one Telegram Bot API
-- message per newly created auth user. Works for signups from any client
-- (frontend, admin API, dashboard-created users) because it reacts to the
-- auth.users row itself, not to any application route.
--
-- NO SECRETS IN THIS FILE. The bot token and chat id live ONLY in Supabase
-- Vault under the names 'telegram_bot_token' and 'telegram_chat_id'. Insert
-- them manually as the database owner (Supabase Dashboard -> SQL editor) —
-- never commit them anywhere:
--   select vault.create_secret('<TELEGRAM_BOT_TOKEN>', 'telegram_bot_token');
--   select vault.create_secret('<TELEGRAM_CHAT_ID>', 'telegram_chat_id');
--
-- Prerequisites (Supabase Dashboard -> Database -> Extensions, then verify):
--   1. pg_net extension (async HTTP from Postgres; never blocks signup).
--   2. supabase_vault extension (server-side secret storage).
-- Without either extension (or without the Vault secrets) the trigger is a
-- silent no-op: signup always succeeds, nothing is sent.
--
-- Failure isolation: pg_net queues the request asynchronously, and EVERYTHING
-- below is wrapped so that any Telegram/Vault/network failure returns NEW
-- unchanged. A notification problem can NEVER abort or roll back registration.
--
-- Dedup: the trigger fires exactly once per auth.users row insert. Re-logins,
-- email confirmations, and profile edits are UPDATEs and never re-fire it.
-- Re-signup with an unconfirmed address reuses the existing auth user
-- (no new row), so no second message is produced.
--
-- Message content (plain text, no parse_mode — nothing to escape):
--   🎉 New Freearn registration!
--   👤 A new user has signed up
--   📅 <UTC timestamp of auth.users.created_at>
--   ✉️ Email confirmed: Yes | No — not confirmed yet
-- Minimal by design: no contact details, no auth secrets, no counters,
-- no endorsements. Email confirmation is reported honestly from the auth row itself.
--
-- Why no Edge Function: a public function URL would need trigger-side
-- authentication, which would put a credential in SQL or require extra
-- infrastructure. Direct pg_net + Vault keeps secrets server-side only and
-- adds no public endpoint. See README for setup and testing.

create or replace function public.notify_telegram_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot_token text;
  v_chat_id text;
  v_when text;
  v_confirmed text;
  v_text text;
  v_url text;
begin
  -- Secrets by NAME only; values live exclusively in Vault (never in repo/SQL).
  select decrypted_secret into v_bot_token
    from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  select decrypted_secret into v_chat_id
    from vault.decrypted_secrets where name = 'telegram_chat_id' limit 1;
  if v_bot_token is null or v_chat_id is null then
    -- Not configured yet: stay silent, signup unaffected.
    return new;
  end if;

  v_when := to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"');
  if new.confirmed_at is null then
    -- At INSERT time a normal signup is unconfirmed; never claim otherwise.
    v_confirmed := 'No — not confirmed yet';
  else
    v_confirmed := 'Yes';
  end if;

  v_text := '🎉 New Freearn registration!' || chr(10)
    || '👤 A new user has signed up' || chr(10)
    || '📅 ' || v_when || chr(10)
    || '✉️ Email confirmed: ' || v_confirmed;

  v_url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage';

  -- Async queue insert: returns immediately, never blocks the signup
  -- transaction on Telegram latency or outage.
  perform net.http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', v_chat_id, 'text', v_text)
  );
  return new;
exception
  when others then
    -- Telegram/Vault/network must never break signup (follows the defensive
    -- pattern of migration 003): swallow and let the auth user exist.
    return new;
end;
$$;

drop trigger if exists on_auth_user_telegram_notify on auth.users;
create trigger on_auth_user_telegram_notify
  after insert on auth.users
  for each row execute function public.notify_telegram_signup();

-- The function needs no caller privileges (triggers fire with definer rights);
-- revoke direct execution explicitly so it cannot be invoked as an RPC.
revoke all on function public.notify_telegram_signup() from public, anon, authenticated;
