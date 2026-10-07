-- Forward migration 006: $0.10 minimum and at most one active request per user.
-- Apply after 005. Only replaces request_withdrawal; settlement and ledger math
-- remain unchanged. Safe to reapply. No existing requests or balances are changed.
-- Service-role API supplies the verified session identity. Client roles cannot execute.
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
  v_existing_user_id uuid;
begin
  if p_user_id is null then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  if p_amount_cents < 10 then
    raise exception 'below_minimum' using errcode = 'P0001';
  end if;
  if p_method is null or p_method not in ('paypal', 'skrill', 'revolut', 'sol', 'usdc_solana') then
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
  select id, ledger_transaction_id, user_id into v_existing_id, v_existing_ledger_id, v_existing_user_id
    from withdrawal_requests
    where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_user_id <> p_user_id then
      raise exception 'invalid_request' using errcode = 'P0001';
    end if;
    request_id := v_existing_id;
    ledger_id := v_existing_ledger_id;
    is_duplicate := true;
    return next;
    return;
  end if;

  -- Retry lookup precedes this rule. The existing per-user lock protects both
  -- this check and the insert: different simultaneous keys cannot create two holds.
  -- Existing active rows are retained; further requests wait until all settle.
  if exists (
    select 1 from withdrawal_requests
    where user_id = p_user_id
      and status in ('requested', 'reviewing', 'approved', 'processing')
  ) then
    raise exception 'pending_withdrawal' using errcode = 'P0001';
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
    select id, ledger_transaction_id, user_id into v_existing_id, v_existing_ledger_id, v_existing_user_id
      from withdrawal_requests
      where idempotency_key = p_idempotency_key;
    if found then
      if v_existing_user_id <> p_user_id then
        raise exception 'invalid_request' using errcode = 'P0001';
      end if;
      request_id := v_existing_id;
      ledger_id := v_existing_ledger_id;
      is_duplicate := true;
      return next;
      return;
    end if;
    raise;
end;
$$;

revoke all on function request_withdrawal(uuid, int, text, text, text) from public, anon, authenticated;
grant execute on function request_withdrawal(uuid, int, text, text, text) to service_role;
