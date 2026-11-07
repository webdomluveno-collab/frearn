-- Offerwall.GG: atomic per-user fractional-cent rewards and reversals.
-- This file is staged in Git only. Apply it under a separately reviewed
-- controlled rollout BEFORE enabling any financial feature flags.
--
-- Placement "Cent" is USD cents; current rate (after manual adjustment) is
-- 60 Cent per $1. Historical conversions can be 70 and must not be repriced.
-- Store signed units at 1/10,000 cent precision, aggregate each user's exact
-- balance and insert only the change in WHOLE cents to the standard ledger.
-- Feature is strict service-role only and relies on authenticated API
-- reconciliation and HMAC verification in the API route.
create or replace function public.process_offerwallgg_conversion(
  p_user_id uuid,
  p_tx_id text,
  p_status text,
  p_units4 bigint,
  p_publisher_revenue_cents integer,
  p_offer_name text default null
)
returns table (outcome text, ledger_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_credit public.provider_events%rowtype;
  v_reversal public.provider_events%rowtype;
  v_prior_units numeric;
  v_current_cents bigint;
  v_new_cents bigint;
  v_delta bigint;
  v_ledger_id uuid := null;
begin
  -- Verifying the JWT claim as well as revoking grants below provides
  -- defense in depth for SECURITY DEFINER running as postgres.
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'offerwallgg_unauthorized' using errcode='P0001';
  end if;
  if p_user_id is null or p_tx_id is null or p_tx_id !~ '^[a-zA-Z0-9_-]{1,64}$'
    or p_status is null or p_status not in ('credited','reversed')
    or p_units4 is null or p_units4 = 0
    or abs(p_units4) > 10000000000
    or p_publisher_revenue_cents is null
    or p_publisher_revenue_cents < 0 or p_publisher_revenue_cents > 1000000
    or (p_status='credited' and p_units4 < 0)
    or (p_status='reversed' and p_units4 > 0)
  then
    raise exception 'offerwallgg_invalid_input' using errcode='P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'offerwallgg_unknown_user' using errcode='P0001';
  end if;

  -- Both keys are intentionally namespaced. Transaction lock first prevents
  -- cross-user concurrent tx collisions, user lock serializes fractional carry.
  perform pg_advisory_xact_lock(hashtextextended('offerwallgg:tx:' || p_tx_id,0));
  perform pg_advisory_xact_lock(hashtextextended('offerwallgg:user:' || p_user_id::text,0));

  select * into v_credit from public.provider_events
    where provider='offerwallgg' and external_event_id='credit:' || p_tx_id
    for update;
  select * into v_reversal from public.provider_events
    where provider='offerwallgg' and external_event_id='reverse:' || p_tx_id
    for update;

  if v_credit.id is not null and v_credit.user_id is distinct from p_user_id then
    raise exception 'offerwallgg_tx_user_conflict' using errcode='P0001';
  end if;
  if v_reversal.id is not null and v_reversal.user_id is distinct from p_user_id then
    raise exception 'offerwallgg_tx_user_conflict' using errcode='P0001';
  end if;

  if p_status='credited' and v_credit.id is not null then
    if (v_credit.raw_payload->>'units4')::bigint is distinct from p_units4 then
      raise exception 'offerwallgg_amount_conflict' using errcode='P0001';
    end if;
    outcome := 'duplicate'; ledger_id := null; return next; return;
  end if;
  if p_status='reversed' and v_reversal.id is not null then
    if (v_reversal.raw_payload->>'units4')::bigint is distinct from p_units4 then
      raise exception 'offerwallgg_amount_conflict' using errcode='P0001';
    end if;
    outcome := 'duplicate'; ledger_id := null; return next; return;
  end if;

  -- A reversal can arrive first or be inferred from the conversions API
  -- before a late credit callback. Record it and block future credit.
  if p_status='reversed' and v_credit.id is null then
    insert into public.provider_events (
      provider,external_event_id,user_id,external_offer_id,event_type,
      publisher_revenue_cents,user_reward_cents,raw_payload,
      processing_status,processed_at
    ) values (
      'offerwallgg','reverse:' || p_tx_id,p_user_id,null,'reversal',
      0,0,jsonb_build_object('units4',p_units4::text,'tx_id',p_tx_id),
      'reversal_pending',now()
    );
    outcome := 'reversal_pending'; ledger_id := null; return next; return;
  end if;

  -- Reversal-before-credit pair cancels without ever inserting a monetary
  -- credit; neither event contributes to the fractional accumulator.
  if p_status='credited' and v_reversal.id is not null then
    if (v_reversal.raw_payload->>'units4')::bigint is distinct from -p_units4 then
      raise exception 'offerwallgg_reversal_conflict' using errcode='P0001';
    end if;
    insert into public.provider_events (
      provider,external_event_id,user_id,external_offer_id,event_type,
      publisher_revenue_cents,user_reward_cents,raw_payload,
      processing_status,processed_at
    ) values (
      'offerwallgg','credit:' || p_tx_id,p_user_id,null,'complete',
      0,0,jsonb_build_object('units4',p_units4::text,'tx_id',p_tx_id),
      'suppressed_reversed_before_credit',now()
    );
    update public.provider_events
      set processing_status='suppressed_reversed_before_credit',processed_at=now()
      where id=v_reversal.id;
    outcome := 'suppressed'; ledger_id := null; return next; return;
  end if;

  if p_status='reversed' and
    ((v_credit.raw_payload->>'units4')::bigint is distinct from -p_units4
    or v_credit.processing_status <> 'processed') then
    raise exception 'offerwallgg_original_conflict' using errcode='P0001';
  end if;

  -- Exact 1/10000 cent arithmetic, serialized by the user advisory lock.
  -- FLOOR ensures pending fractional units cannot be withdrawn early.
  select coalesce(sum((raw_payload->>'units4')::numeric),0)
    into v_prior_units
    from public.provider_events
    where provider='offerwallgg' and user_id=p_user_id
      and processing_status='processed' and event_type in ('complete','reversal');

  v_current_cents := floor(v_prior_units / 10000)::bigint;
  v_new_cents := floor((v_prior_units + p_units4) / 10000)::bigint;
  v_delta := v_new_cents - v_current_cents;
  if abs(v_delta) > 1000000 then
    raise exception 'offerwallgg_delta_out_of_bounds' using errcode='P0001';
  end if;

  insert into public.provider_events (
    provider,external_event_id,user_id,external_offer_id,event_type,
    publisher_revenue_cents,user_reward_cents,raw_payload,
    processing_status,processed_at
  ) values (
    'offerwallgg',
    (case when p_status='credited' then 'credit:' else 'reverse:' end) || p_tx_id,
    p_user_id,null,(case when p_status='credited' then 'complete' else 'reversal' end),
    (case when p_status='credited' then p_publisher_revenue_cents else 0 end),
    v_delta::integer,
    jsonb_build_object('units4',p_units4::text,'tx_id',p_tx_id,
      'offer_name',left(coalesce(p_offer_name,''),100)),
    'processed',now()
  );

  if v_delta <> 0 then
    insert into public.ledger_transactions (
      user_id,type,status,amount_cents,description,idempotency_key,
      provider,provider_transaction_id,publisher_revenue_cents,metadata
    ) values (
      p_user_id,
      (case when p_status='credited' then 'offer_reward' else 'reversal' end),
      'confirmed',v_delta::integer,
      left('Offerwall.GG ' || p_status || ' ' || p_tx_id,140),
      'offerwallgg:' || p_tx_id || ':' || p_status,
      'offerwallgg',p_tx_id,
      (case when p_status='credited' then p_publisher_revenue_cents else 0 end),
      jsonb_build_object('units4',p_units4::text,'fractional_carry',true)
    ) returning id into v_ledger_id;
  end if;

  outcome := case when v_delta=0 then 'fractional_recorded'
                  when p_status='credited' then 'credited'
                  else 'reversed' end;
  ledger_id := v_ledger_id; return next; return;
end;
$$;

revoke all on function public.process_offerwallgg_conversion(uuid,text,text,bigint,integer,text)
  from public, anon, authenticated;
grant execute on function public.process_offerwallgg_conversion(uuid,text,text,bigint,integer,text)
  to service_role;
