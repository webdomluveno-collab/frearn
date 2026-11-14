-- AdMantum atomic crediting. Staged only; do not apply to production without review.
-- virtual_currency is already the user's Cent amount at the configured 60-unit ratio.
-- Reversals are intentionally NOT auto-applied: AdMantum documents a new
-- transaction_id for status=0 but no original-transaction binding.
create or replace function public.process_admantum_credit(
  p_user_id uuid,
  p_tx_id text,
  p_virtual_currency bigint,
  p_reward_cents bigint,
  p_publisher_revenue_cents integer,
  p_offer_id text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (outcome text, ledger_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.provider_events%rowtype;
  v_ledger_id uuid;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'admantum_unauthorized' using errcode='P0001';
  end if;
  if p_user_id is null or p_tx_id is null or p_tx_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_virtual_currency is null or p_virtual_currency <= 0
    or p_reward_cents is null or p_reward_cents <= 0
    or p_reward_cents > 100000000
    or p_publisher_revenue_cents is null or p_publisher_revenue_cents < 0
    or p_publisher_revenue_cents > 1000000000
  then
    raise exception 'admantum_invalid_input' using errcode='P0001';
  end if;
  if p_virtual_currency <> p_reward_cents then
    raise exception 'admantum_reward_mismatch' using errcode='P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'admantum_unknown_user' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('admantum:tx:' || p_tx_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('admantum:user:' || p_user_id::text, 0));

  select * into v_event
    from public.provider_events
   where provider = 'admantum' and external_event_id = 'credit:' || p_tx_id
   for update;

  if v_event.id is not null then
    if v_event.user_id is distinct from p_user_id
       or (v_event.raw_payload->>'virtual_currency')::bigint is distinct from p_virtual_currency
    then
      raise exception 'admantum_transaction_conflict' using errcode='P0001';
    end if;
    outcome := 'duplicate'; ledger_id := null; return next; return;
  end if;

  insert into public.provider_events (
    provider, external_event_id, user_id, external_offer_id, event_type,
    publisher_revenue_cents, user_reward_cents, raw_payload,
    processing_status, processed_at
  ) values (
    'admantum', 'credit:' || p_tx_id, p_user_id, nullif(left(p_offer_id, 128), ''), 'complete',
    p_publisher_revenue_cents, p_reward_cents::integer,
    coalesce(p_raw_payload, '{}'::jsonb) ||
      jsonb_build_object('virtual_currency', p_virtual_currency::text, 'tx_id', p_tx_id),
    'processed', now()
  );

  insert into public.ledger_transactions (
    user_id, type, status, amount_cents, description, idempotency_key,
    provider, provider_transaction_id, publisher_revenue_cents, metadata
  ) values (
    p_user_id, 'offer_reward', 'confirmed', p_reward_cents::integer,
    left('AdMantum credited ' || p_tx_id, 140),
    'admantum:' || p_tx_id || ':credited', 'admantum', p_tx_id,
    p_publisher_revenue_cents,
    jsonb_build_object('virtual_currency', p_virtual_currency::text, 'points_ratio', 60)
  ) returning id into v_ledger_id;

  outcome := 'credited'; ledger_id := v_ledger_id; return next; return;
end;
$$;

revoke all on function public.process_admantum_credit(uuid,text,bigint,bigint,integer,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.process_admantum_credit(uuid,text,bigint,bigint,integer,text,jsonb)
  to service_role;

create or replace function public.record_admantum_pending(
  p_user_id uuid,
  p_tx_id text,
  p_status text,
  p_virtual_currency bigint,
  p_offer_id text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (outcome text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event public.provider_events%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'admantum_unauthorized' using errcode='P0001';
  end if;
  if p_user_id is null or p_tx_id is null or p_tx_id !~ '^[A-Za-z0-9_-]{1,128}$'
     or p_status not in ('credited','reversed') or p_virtual_currency is null or p_virtual_currency <= 0
  then
    raise exception 'admantum_invalid_input' using errcode='P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'admantum_unknown_user' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('admantum:pending:' || p_tx_id, 0));
  select * into v_event from public.provider_events
   where provider='admantum' and external_event_id='pending:' || p_tx_id for update;
  if v_event.id is not null then
    outcome := 'duplicate'; return next; return;
  end if;
  insert into public.provider_events (
    provider, external_event_id, user_id, event_type, user_reward_cents,
    raw_payload, processing_status, processed_at
  ) values (
    'admantum', 'pending:' || p_tx_id, p_user_id,
    case when p_status='credited' then 'complete' else 'reversal' end,
    0, coalesce(p_raw_payload, '{}'::jsonb) || jsonb_build_object(
      'tx_id', p_tx_id, 'virtual_currency', p_virtual_currency::text,
      'manual_review_required', true
    ), 'pending_manual_review', now()
  );
  outcome := 'pending_manual_review'; return next; return;
end;
$$;

revoke all on function public.record_admantum_pending(uuid,text,text,bigint,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_admantum_pending(uuid,text,text,bigint,text,jsonb)
  to service_role;
