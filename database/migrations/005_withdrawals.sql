-- Migration 005: manual withdrawal requests with atomic fund reservation.
-- Idempotent: safe to run multiple times (IF NOT EXISTS / OR REPLACE / DROP+CREATE with checks).
--
-- Model (immutable ledger, no balance mutation):
--   request  -> ONE transaction inserts a PENDING withdrawal ledger row
--               (negative cents = immediate reservation) + a withdrawal_requests
--               row linked via ledger_transaction_id. Same balance can never be
--               requested twice: funds are reserved before any second request
--               can observe them (per-user advisory lock + single transaction).
--   paid     -> hold row pending -> confirmed. Deduction stands.
--   rejected -> hold row pending -> reversed + immutable reversal credit row
--               (+amount, type 'reversal', reason withdrawal_rejected).
--               History is never deleted; rejected funds return exactly once.
-- Duplicate submissions collapse on idempotency_key (ledger) and
-- withdrawal_requests.idempotency_key. Duplicate admin settles are no-ops.
--
-- RLS: users keep SELECT-own only. All writes go through SECURITY DEFINER
-- RPCs, revoked from anon/authenticated (service-role bypasses RLS).
-- RLS, auth, and provider behavior are otherwise untouched.

alter table if exists withdrawal_requests
  add column if not exists idempotency_key text,
  add column if not exists ledger_transaction_id uuid references ledger_transactions(id) on delete restrict,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists reviewed_by text,
  add column if not exists failure_reason text;

-- Backfill any pre-existing rows (none expected pre-launch) so the unique
-- constraint below can be created safely.
update withdrawal_requests set idempotency_key = 'legacy:' || id::text where idempotency_key is null;

alter table if exists withdrawal_requests
  alter column idempotency_key set not null;

drop index if exists withdrawal_requests_idempotency_uidx;
create unique index if not exists withdrawal_requests_idempotency_uidx
  on withdrawal_requests (idempotency_key);

drop index if exists withdrawal_requests_user_status_idx;
create index if not exists withdrawal_requests_user_status_idx
  on withdrawal_requests (user_id, status);

-- ---------------------------------------------------------------------------
-- request_withdrawal: atomic reserve-on-request.
-- Raises (message-mapped by the API layer, never shown raw to users):
--   invalid_amount      — not a positive integer
--   below_minimum       — below 300 cents ($3.00)
--   invalid_method      — not an active manual method
--   invalid_destination — empty / too long
--   insufficient_balance— confirmed minus pending holds < amount
-- Unique violation on either idempotency key returns the existing request
-- (duplicate submission / retry) instead of deducting twice.
-- ---------------------------------------------------------------------------
create or replace function request_withdrawal(
  p_user_id uuid,
  p_amount_cents int,
  p_method text,
  p_destination text,
  p_idempotency_key text
)
returns table (request_id uuid, ledger_id uuid, is_duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmed_sum int;
  v_reserved_sum int;
  v_available int;
  v_ledger_id uuid;
  v_request_id uuid;
  v_existing_id uuid;
  v_existing_ledger_id uuid;
begin
  if p_user_id is null then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_amount_cents < 300 then
    raise exception 'below_minimum' using errcode = 'P0001';
  end if;
  if p_method not in ('paypal', 'skrill', 'revolut', 'sol', 'usdc_solana') then
    raise exception 'invalid_method' using errcode = 'P0001';
  end if;
  if p_destination is null or btrim(p_destination) = '' or char_length(p_destination) > 320 then
    raise exception 'invalid_destination' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  -- Serialize per-user withdrawals: concurrent requests cannot overspend.
  perform pg_advisory_xact_lock(hashtext('withdrawal:' || p_user_id::text));

  -- Duplicate submission: return the original request, deduct nothing new.
  select id, ledger_transaction_id into v_existing_id, v_existing_ledger_id
    from withdrawal_requests
    where idempotency_key = p_idempotency_key;
  if found then
    request_id := v_existing_id;
    ledger_id := v_existing_ledger_id;
    is_duplicate := true;
    return next;
    return;
  end if;

  -- Available = confirmed sum minus pending withdrawal holds (immutable math).
  select coalesce(sum(amount_cents), 0) into v_confirmed_sum
    from ledger_transactions
    where user_id = p_user_id and status = 'confirmed';
  select coalesce(sum(-amount_cents), 0) into v_reserved_sum
    from ledger_transactions
    where user_id = p_user_id and type = 'withdrawal' and status = 'pending';
  v_available := v_confirmed_sum - v_reserved_sum;

  if v_available < p_amount_cents then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  -- Reserve: pending negative hold. Same key discipline as provider rewards.
  insert into ledger_transactions (user_id, type, status, amount_cents, description, idempotency_key, provider, metadata)
  values (
    p_user_id,
    'withdrawal',
    'pending',
    -p_amount_cents,
    'Withdrawal request (manual review)',
    'wd:' || p_idempotency_key,
    'manual',
    jsonb_build_object('method', p_method)
  )
  returning id into v_ledger_id;

  insert into withdrawal_requests (user_id, amount_cents, method, destination, status, idempotency_key, ledger_transaction_id)
  values (p_user_id, p_amount_cents, p_method, btrim(p_destination), 'requested', p_idempotency_key, v_ledger_id)
  returning id into v_request_id;

  request_id := v_request_id;
  ledger_id := v_ledger_id;
  is_duplicate := false;
  return next;
exception
  when unique_violation then
    -- Lost race on either key: return the winner instead of deducting twice.
    select id, ledger_transaction_id into v_existing_id, v_existing_ledger_id
      from withdrawal_requests
      where idempotency_key = p_idempotency_key;
    if found then
      request_id := v_existing_id;
      ledger_id := v_existing_ledger_id;
      is_duplicate := true;
      return next;
      return;
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- settle_withdrawal: idempotent admin transition.
-- p_action: 'paid' | 'rejected'. Only from non-terminal states; repeating the
-- same action is a no-op returning already=true (never double-pay/refund).
--   paid:     request -> paid, hold row pending -> confirmed (deduction stands)
--   rejected: request -> rejected, hold row pending -> reversed,
--             + zero-amount immutable reversal marker (type 'reversal',
--             reason withdrawal_rejected, reverses_ledger_id). The voided hold
--             restores availability; the marker documents it without moving
--             money (a positive credit would double-count alongside the reward
--             and inflate lifetime earnings).
-- ---------------------------------------------------------------------------
create or replace function settle_withdrawal(
  p_request_id uuid,
  p_action text,
  p_actor text
)
returns table (request_id uuid, new_status text, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row withdrawal_requests%rowtype;
begin
  if p_action not in ('paid', 'rejected') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  select * into v_row from withdrawal_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_row.status = p_action then
    request_id := v_row.id;
    new_status := v_row.status;
    already := true;
    return next;
    return;
  end if;

  if v_row.status not in ('requested', 'reviewing', 'approved', 'processing') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_action = 'paid' then
    update withdrawal_requests
      set status = 'paid', updated_at = now(), reviewed_by = p_actor
      where id = p_request_id;
    update ledger_transactions
      set status = 'confirmed'
      where id = v_row.ledger_transaction_id and status = 'pending';
  else
    update withdrawal_requests
      set status = 'rejected', updated_at = now(), reviewed_by = p_actor
      where id = p_request_id;
    -- Nullify the hold, then record an immutable zero-amount reversal marker.
    -- (A positive credit here would double-count: the original reward still
    -- stands, so voiding the reserve is the exact restoration.)
    update ledger_transactions
      set status = 'reversed'
      where id = v_row.ledger_transaction_id and status = 'pending';
    insert into ledger_transactions (user_id, type, status, amount_cents, description, idempotency_key, provider, metadata)
    values (
      v_row.user_id,
      'reversal',
      'confirmed',
      0,
      'Withdrawal rejected — reserved funds returned',
      'wd:' || v_row.idempotency_key || ':refund',
      'manual',
      jsonb_build_object('reverses_ledger_id', v_row.ledger_transaction_id, 'reason', 'withdrawal_rejected')
    )
    on conflict (idempotency_key) do nothing;
  end if;

  request_id := p_request_id;
  new_status := p_action;
  already := false;
  return next;
end;
$$;

-- Only service-role (and postgres) may execute: API routes call via
-- getSupabaseAdmin() after session/admin checks. Explicitly revoke from
-- anon/authenticated so RLS deny-by-default extends to the RPC surface.
revoke all on function request_withdrawal(uuid, int, text, text, text) from public, anon, authenticated;
revoke all on function settle_withdrawal(uuid, text, text) from public, anon, authenticated;
