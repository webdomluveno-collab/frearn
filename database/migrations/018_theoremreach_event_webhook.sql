-- Migration 018: TheoremReach Event Webhook (reversal + ban) and ordering fence.
-- Prepared locally only. Do not apply without a separately approved rollout.
--
-- Official contract: the Event Webhook is a separate POST endpoint, signed with
-- the same HMAC-SHA1 scheme as the Reward Callback. `enc_salt` is the unique
-- event id; the body is not part of the signature. A reversal may arrive before
-- the corresponding reward, so both paths take a transaction-scoped advisory
-- lock and the reward path refuses to credit while a reversal is pending.

-- Replace the reward RPC with the ordering fence. This is intentionally the
-- same reward semantics as 014 plus the advisory lock and pending-reversal check.
create or replace function public.process_theoremreach_reward(
  p_user_id uuid,
  p_tx_id text,
  p_reward_cents int,
  p_publisher_revenue_cents int,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (outcome text, ledger_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.provider_events%rowtype;
  v_pending public.provider_events%rowtype;
  v_reward public.ledger_transactions%rowtype;
  v_event_inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'theoremreach_unauthorized' using errcode = 'P0001';
  end if;
  if p_user_id is null or p_tx_id is null or p_tx_id !~ '^[A-Za-z0-9_:.-]{1,128}$' then
    raise exception 'theoremreach_invalid_identity' using errcode = 'P0001';
  end if;
  if p_reward_cents is null or p_reward_cents <= 0 or p_reward_cents > 1000000 then
    raise exception 'theoremreach_invalid_reward' using errcode = 'P0001';
  end if;
  if p_publisher_revenue_cents is null or p_publisher_revenue_cents < 0 then
    raise exception 'theoremreach_invalid_revenue' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'theoremreach_unknown_user' using errcode = 'P0001';
  end if;

  -- Serialize reward and reversal for the same provider transaction.
  perform pg_advisory_xact_lock(hashtextextended('theoremreach:' || p_tx_id, 0));

  -- A reversal that arrived first must never be followed by a credit.
  select * into v_pending
    from public.provider_events
    where provider = 'theoremreach'
      and event_type = 'reversal'
      and raw_payload->>'tx_id' = p_tx_id
    order by received_at
    limit 1
    for update;

  if found then
    if v_pending.user_id is not null and v_pending.user_id <> p_user_id then
      raise exception 'theoremreach_reversal_user_conflict' using errcode = 'P0001';
    end if;
    update public.provider_events
      set processing_status = 'reversal_pending', processed_at = now(), error = null
      where id = v_pending.id;
    outcome := 'reversal_pending';
    ledger_id := null;
    return next;
    return;
  end if;

  insert into public.provider_events (
    provider, external_event_id, user_id, external_offer_id, event_type,
    publisher_revenue_cents, user_reward_cents, raw_payload,
    processing_status, error
  ) values (
    'theoremreach', p_tx_id, p_user_id, null, 'complete',
    p_publisher_revenue_cents, p_reward_cents, coalesce(p_raw_payload, '{}'::jsonb),
    'received', null
  )
  on conflict (provider, external_event_id) do nothing
  returning * into v_event;
  v_event_inserted := found;

  if not v_event_inserted then
    select * into v_event
      from public.provider_events
      where provider = 'theoremreach' and external_event_id = p_tx_id
      for update;
    if v_event.user_id is distinct from p_user_id
      or v_event.event_type is distinct from 'complete'
      or v_event.user_reward_cents is distinct from p_reward_cents
      or v_event.publisher_revenue_cents is distinct from p_publisher_revenue_cents then
      raise exception 'theoremreach_tx_id_conflict' using errcode = 'P0001';
    end if;
  end if;

  insert into public.ledger_transactions (
    user_id, type, status, amount_cents, description, idempotency_key,
    provider, provider_transaction_id, publisher_revenue_cents, metadata
  ) values (
    p_user_id, 'survey_reward', 'confirmed', p_reward_cents,
    left('Survey reward (TheoremReach ' || p_tx_id || ')', 140),
    'theoremreach:' || p_tx_id || ':reward',
    'theoremreach', p_tx_id, p_publisher_revenue_cents,
    jsonb_build_object('tx_id', p_tx_id, 'publisher_revenue_cents', p_publisher_revenue_cents)
  )
  on conflict (idempotency_key) do nothing
  returning * into v_reward;

  if not found then
    select * into v_reward
      from public.ledger_transactions
      where idempotency_key = 'theoremreach:' || p_tx_id || ':reward'
      for update;
    if v_reward.user_id is distinct from p_user_id
      or v_reward.amount_cents is distinct from p_reward_cents
      or v_reward.publisher_revenue_cents is distinct from p_publisher_revenue_cents
      or v_reward.type is distinct from 'survey_reward' then
      raise exception 'theoremreach_ledger_conflict' using errcode = 'P0001';
    end if;
    update public.provider_events
      set processing_status = 'duplicate_processed', processed_at = now(), error = null
      where id = v_event.id;
    outcome := 'duplicate';
    ledger_id := v_reward.id;
    return next;
    return;
  end if;

  update public.provider_events
    set processing_status = 'processed', processed_at = now(), error = null
    where id = v_event.id;
  outcome := 'rewarded';
  ledger_id := v_reward.id;
  return next;
end;
$$;

-- One reversed transaction from an Event Webhook. The provider event id is the
-- `enc_salt` plus the transaction id, so one webhook may carry several reversed
-- transactions and each remains independently idempotent.
create or replace function public.process_theoremreach_reversal(
  p_event_id text,
  p_user_id uuid,
  p_tx_id text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (outcome text, ledger_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.provider_events%rowtype;
  v_reward public.ledger_transactions%rowtype;
  v_reversal public.ledger_transactions%rowtype;
  v_profile_id uuid;
  v_event_inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'theoremreach_unauthorized' using errcode = 'P0001';
  end if;
  if p_event_id is null or length(p_event_id) < 1 or length(p_event_id) > 128
    or p_event_id ~ '[[:space:][:cntrl:]]'
    or p_tx_id is null or p_tx_id !~ '^[A-Za-z0-9_:.-]{1,128}$' then
    raise exception 'theoremreach_invalid_identity' using errcode = 'P0001';
  end if;
  if p_user_id is null then
    raise exception 'theoremreach_invalid_identity' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('theoremreach:' || p_tx_id, 0));

  select id into v_profile_id from public.profiles where id = p_user_id;

  insert into public.provider_events (
    provider, external_event_id, user_id, external_offer_id, event_type,
    publisher_revenue_cents, user_reward_cents, raw_payload,
    processing_status, error
  ) values (
    'theoremreach', 'reversal:' || p_event_id || ':' || p_tx_id,
    v_profile_id, null, 'reversal', 0, 0, coalesce(p_raw_payload, '{}'::jsonb),
    'received', null
  )
  on conflict (provider, external_event_id) do nothing
  returning * into v_event;
  v_event_inserted := found;

  if not v_event_inserted then
    select * into v_event
      from public.provider_events
      where provider = 'theoremreach'
        and external_event_id = 'reversal:' || p_event_id || ':' || p_tx_id
      for update;
    if v_event.event_type is distinct from 'reversal'
      or (v_event.user_id is not null and v_event.user_id is distinct from p_user_id) then
      raise exception 'theoremreach_reversal_event_conflict' using errcode = 'P0001';
    end if;
    if v_event.processing_status in ('processed', 'duplicate_processed') then
      select * into v_reversal
        from public.ledger_transactions
        where idempotency_key = 'theoremreach:' || p_tx_id || ':reversal';
      outcome := 'duplicate';
      ledger_id := v_reversal.id;
      return next;
      return;
    end if;
  end if;

  select * into v_reward
    from public.ledger_transactions
    where provider = 'theoremreach'
      and provider_transaction_id = p_tx_id
      and type = 'survey_reward'
    for update;

  if not found then
    update public.provider_events
      set processing_status = 'orphan_reversal', processed_at = now(), error = null
      where id = v_event.id;
    outcome := 'orphan_reversal';
    ledger_id := null;
    return next;
    return;
  end if;

  if v_reward.user_id is distinct from p_user_id then
    raise exception 'theoremreach_reversal_user_conflict' using errcode = 'P0001';
  end if;
  if v_reward.amount_cents <= 0 then
    raise exception 'theoremreach_reversal_amount_conflict' using errcode = 'P0001';
  end if;

  insert into public.ledger_transactions (
    user_id, type, status, amount_cents, description, idempotency_key,
    provider, provider_transaction_id, publisher_revenue_cents, metadata
  ) values (
    p_user_id, 'reversal', 'confirmed', -v_reward.amount_cents,
    left('Reversal (TheoremReach ' || p_tx_id || ')', 140),
    'theoremreach:' || p_tx_id || ':reversal',
    'theoremreach', p_tx_id, 0,
    jsonb_build_object(
      'tx_id', p_tx_id,
      'reverses_ledger_id', v_reward.id,
      'event_id', p_event_id,
      'source', 'theoremreach_event_webhook'
    )
  )
  on conflict (idempotency_key) do nothing
  returning * into v_reversal;

  if not found then
    select * into v_reversal
      from public.ledger_transactions
      where idempotency_key = 'theoremreach:' || p_tx_id || ':reversal'
      for update;
    if v_reversal.user_id is distinct from p_user_id
      or v_reversal.amount_cents is distinct from -v_reward.amount_cents
      or v_reversal.type is distinct from 'reversal' then
      raise exception 'theoremreach_reversal_ledger_conflict' using errcode = 'P0001';
    end if;
    update public.provider_events
      set processing_status = 'duplicate_processed', processed_at = now(), error = null
      where id = v_event.id;
    outcome := 'duplicate';
    ledger_id := v_reversal.id;
    return next;
    return;
  end if;

  update public.provider_events
    set processing_status = 'processed', processed_at = now(), error = null
    where id = v_event.id;
  outcome := 'reversed';
  ledger_id := v_reversal.id;
  return next;
end;
$$;

-- Ban events have no financial effect. They are recorded idempotently and, when
-- the user exists, raise one high-severity fraud flag per event.
create or replace function public.process_theoremreach_ban(
  p_event_id text,
  p_user_id uuid,
  p_reason text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.provider_events%rowtype;
  v_profile_id uuid;
  v_event_inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'theoremreach_unauthorized' using errcode = 'P0001';
  end if;
  if p_event_id is null or length(p_event_id) < 1 or length(p_event_id) > 128
    or p_event_id ~ '[[:space:][:cntrl:]]'
    or p_user_id is null then
    raise exception 'theoremreach_invalid_identity' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('theoremreach:ban:' || p_event_id, 0));

  select id into v_profile_id from public.profiles where id = p_user_id;

  insert into public.provider_events (
    provider, external_event_id, user_id, external_offer_id, event_type,
    publisher_revenue_cents, user_reward_cents, raw_payload,
    processing_status, error
  ) values (
    'theoremreach', 'ban:' || p_event_id, v_profile_id, null, 'ban', 0, 0,
    coalesce(p_raw_payload, '{}'::jsonb), 'received', null
  )
  on conflict (provider, external_event_id) do nothing
  returning * into v_event;
  v_event_inserted := found;

  if not v_event_inserted then
    select * into v_event
      from public.provider_events
      where provider = 'theoremreach' and external_event_id = 'ban:' || p_event_id
      for update;
    if v_event.event_type is distinct from 'ban'
      or (v_event.user_id is not null and v_event.user_id is distinct from p_user_id) then
      raise exception 'theoremreach_ban_event_conflict' using errcode = 'P0001';
    end if;
    update public.provider_events
      set processing_status = 'duplicate_processed', processed_at = now(), error = null
      where id = v_event.id;
    outcome := 'duplicate';
    return next;
    return;
  end if;

  if v_profile_id is not null then
    insert into public.fraud_flags (user_id, reason, severity, risk_score)
    values (
      v_profile_id,
      left('theoremreach_ban:' || coalesce(p_reason, ''), 200),
      'high',
      100
    );
  end if;

  update public.provider_events
    set processing_status = 'processed', processed_at = now(), error = null
    where id = v_event.id;
  outcome := 'banned';
  return next;
end;
$$;

revoke all on function public.process_theoremreach_reward(uuid, text, int, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_theoremreach_reward(uuid, text, int, int, jsonb)
  to service_role;

revoke all on function public.process_theoremreach_reversal(text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_theoremreach_reversal(text, uuid, text, jsonb)
  to service_role;

revoke all on function public.process_theoremreach_ban(text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_theoremreach_ban(text, uuid, text, jsonb)
  to service_role;
