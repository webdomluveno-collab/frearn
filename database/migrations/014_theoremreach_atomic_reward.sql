-- Migration 014: atomic TheoremReach reward callback transaction.
-- Prepared locally only. Do not apply without a separately approved rollout.
--
-- This function intentionally handles confirmed rewards only. Reversal delivery
-- is still unresolved between Reward Callback and Event Webhook; automatic
-- reversal processing stays disabled in application code until that contract is
-- confirmed with provider test data.

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
set search_path = public
as $$
declare
  v_event provider_events%rowtype;
  v_reward ledger_transactions%rowtype;
  v_event_inserted boolean := false;
begin
  -- The HMAC is verified by the server route before this RPC is called.
  -- The RPC is service-role-only defense in depth, never a client credit API.
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
  if not exists (select 1 from profiles where id = p_user_id) then
    raise exception 'theoremreach_unknown_user' using errcode = 'P0001';
  end if;

  -- The unique provider-event key serializes concurrent callbacks for tx_id.
  -- This insert and the ledger insert below are one PostgreSQL transaction.
  insert into provider_events (
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
      from provider_events
      where provider = 'theoremreach' and external_event_id = p_tx_id
      for update;
    if v_event.user_id is distinct from p_user_id
      or v_event.event_type <> 'complete'
      or v_event.user_reward_cents <> p_reward_cents
      or v_event.publisher_revenue_cents <> p_publisher_revenue_cents then
      raise exception 'theoremreach_tx_id_conflict' using errcode = 'P0001';
    end if;
  end if;

  insert into ledger_transactions (
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
      from ledger_transactions
      where idempotency_key = 'theoremreach:' || p_tx_id || ':reward'
      for update;
    if v_reward.user_id <> p_user_id
      or v_reward.amount_cents <> p_reward_cents
      or v_reward.publisher_revenue_cents <> p_publisher_revenue_cents
      or v_reward.type <> 'survey_reward' then
      raise exception 'theoremreach_ledger_conflict' using errcode = 'P0001';
    end if;
    update provider_events
      set processing_status = 'duplicate_processed', processed_at = now(), error = null
      where id = v_event.id;
    outcome := 'duplicate';
    ledger_id := v_reward.id;
    return next;
    return;
  end if;

  update provider_events
    set processing_status = 'processed', processed_at = now(), error = null
    where id = v_event.id;
  outcome := 'rewarded';
  ledger_id := v_reward.id;
  return next;
end;
$$;

revoke all on function public.process_theoremreach_reward(uuid, text, int, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_theoremreach_reward(uuid, text, int, int, jsonb)
  to service_role;
