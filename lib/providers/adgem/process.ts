import "server-only";

import {
  ADGEM_MAX_REWARD_CENTS,
  adgemRewardKey,
  adgemTxnRef,
  type AdgemPostbackBody,
} from "./shared";

export const ADGEM_PROVIDER_KEY = "adgem";

/**
 * AdGem Server Postback v3 processor.
 *
 * CONFIRMED MONEY MAPPING (publisher property: cent/cents, multiplier 70,
 * Rounded): `data.amount` arrives as whole USD cents of the user's reward
 * (amount:35 → +35¢). `data.payout_cents` is publisher revenue (audit only)
 * and NEVER determines the user's balance. No further math is applied.
 *
 * CRASH/RACE SAFETY: idempotency verdicts are LEDGER-anchored, never
 * event-anchored. A provider_events row alone never proves a reward was
 * credited — every duplicate verdict re-verifies the ledger row first, so a
 * crash between event insert and ledger insert can only resolve to a credit
 * on retry, never to a silent loss. DB unique constraints (idempotency_key
 * and the composite (provider, provider_transaction_id, type) index) close
 * concurrent races; no transaction primitive is required.
 */

export interface AdgemStoredEvent {
  userId: string | null;
  conversionId: string;
}

export interface AdgemRewardRow {
  id: string;
  userId: string;
  amountCents: number;
}

export interface AdgemLedgerInsert {
  userId: string;
  type: "offer_reward";
  status: "confirmed";
  amountCents: number;
  description: string;
  idempotencyKey: string;
  provider: string;
  providerTransactionId: string;
  publisherRevenueCents: number;
  metadata: Record<string, unknown>;
}

export interface AdgemEventInsert {
  provider: string;
  externalEventId: string;
  userId: string | null;
  externalOfferId: string | null;
  eventType: string;
  publisherRevenueCents: number;
  /** Always 0 on the event row: the credited value lives on the ledger row. */
  userRewardCents: number;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  error: string | null;
}

export interface AdgemStore {
  findProfile(userId: string): Promise<{ id: string } | null>;
  /** Insert event; unique (provider, external_event_id). Returns inserted=false on conflict. */
  insertProviderEvent(row: AdgemEventInsert): Promise<{ inserted: boolean }>;
  findEventByRequestId(requestId: string): Promise<AdgemStoredEvent | null>;
  markEventProcessed(requestId: string, processingStatus: string, error: string | null): Promise<void>;
  findRewardByTxnRef(txnRef: string): Promise<AdgemRewardRow | null>;
  /** Insert ledger row; unique idempotency_key + composite. Returns inserted=false on conflict. */
  insertLedgerReward(row: AdgemLedgerInsert): Promise<{ id: string; inserted: boolean }>;
  insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }): Promise<void>;
}

export type AdgemOutcome =
  | { outcome: "credited"; ledgerId: string }
  | { outcome: "recorded" }
  | { outcome: "duplicate"; detail: string }
  | {
      outcome: "rejected";
      error: "unknown_player" | "unsupported_conversion_type" | "request_id_mismatch" | "reward_user_mismatch" | "invalid_amount";
    };

/** Audit metadata only: identifiers useful for support/replay. No PII (no GAID/IDFA/IP/UA), no secrets. */
function eventPayload(b: AdgemPostbackBody): Record<string, unknown> {
  return {
    request_id: b.requestId,
    conversion_id: b.conversionId,
    offer_id: b.offerId,
    goal_id: b.goalId,
    goal_name: b.goalName,
    offer_name: b.offerName,
    campaign_id: b.campaignId,
    conversion_type: b.conversionType,
    amount_raw: b.amountRaw,
    amount_unit: "usd_cents_per_property_config_v1",
    payout_cents: b.payoutCents,
    all_goals_completed: b.allGoalsCompleted,
  };
}

function describeReward(b: AdgemPostbackBody): string {
  const offer = (b.offerName || b.offerId || "AdGem").slice(0, 60);
  const goal = b.goalName ? ` — ${b.goalName.slice(0, 60)}` : "";
  return `Offer reward (AdGem ${offer}${goal})`.slice(0, 140);
}

export async function processAdgemPostback(store: AdgemStore, b: AdgemPostbackBody): Promise<AdgemOutcome> {
  const profile = await store.findProfile(b.playerId);
  if (!profile) {
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: null,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "rejected",
      error: "unknown_player",
    });
    return { outcome: "rejected", error: "unknown_player" };
  }

  if (b.conversionType !== "reward" && b.conversionType !== "install") {
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: profile.id,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "rejected",
      error: "unsupported_conversion_type",
    });
    return { outcome: "rejected", error: "unsupported_conversion_type" };
  }

  if (b.conversionType === "install") {
    // Documented non-monetary tracking event: record, never credit.
    const { inserted } = await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: profile.id,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "received",
      error: null,
    });
    if (!inserted) {
      await store.markEventProcessed(b.requestId, "duplicate_processed", null);
      return { outcome: "duplicate", detail: "request_id_seen" };
    }
    await store.markEventProcessed(b.requestId, "processed", null);
    return { outcome: "recorded" };
  }

  // ---- Verified monetary reward: LEDGER-ANCHORED processing ----
  const txnRef = adgemTxnRef(b.conversionId, b.goalId);
  const idempotencyKey = adgemRewardKey(b.conversionId, b.goalId);

  // Defensive re-check (route shape already enforces this): only whole,
  // positive, in-range cents may become money. Never trust, never coerce.
  if (!Number.isInteger(b.amountRaw) || b.amountRaw <= 0 || b.amountRaw > ADGEM_MAX_REWARD_CENTS) {
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: profile.id,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "rejected",
      error: "invalid_amount",
    });
    return { outcome: "rejected", error: "invalid_amount" };
  }

  // 1. Ledger first: an existing reward for this conversion+goal settles everything.
  const existing = await store.findRewardByTxnRef(txnRef);
  if (existing) {
    if (existing.userId !== profile.id) {
      await store.insertFraudFlag({ userId: profile.id, reason: "adgem_reward_user_mismatch", severity: "high" });
      return { outcome: "rejected", error: "reward_user_mismatch" };
    }
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: profile.id,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "duplicate_processed",
      error: null,
    }).catch(() => undefined);
    await store.markEventProcessed(b.requestId, "duplicate_processed", null).catch(() => undefined);
    return { outcome: "duplicate", detail: "reward_exists" };
  }

  // 2. Record the delivery attempt. On conflict, verify it is the SAME
  //    conversion before proceeding — a shared request_id across different
  //    conversions is hostile/malformed and must never credit.
  const { inserted: eventInserted } = await store.insertProviderEvent({
    provider: ADGEM_PROVIDER_KEY,
    externalEventId: b.requestId,
    userId: profile.id,
    externalOfferId: b.offerId,
    eventType: b.conversionType,
    publisherRevenueCents: b.payoutCents,
    userRewardCents: 0,
    rawPayload: eventPayload(b),
    processingStatus: "received",
    error: null,
  });
  if (!eventInserted) {
    const prior = await store.findEventByRequestId(b.requestId);
    if (!prior || prior.conversionId !== b.conversionId || prior.userId !== profile.id) {
      await store.insertFraudFlag({ userId: profile.id, reason: "adgem_request_id_mismatch", severity: "high" });
      await store.markEventProcessed(b.requestId, "rejected", "request_id_mismatch");
      return { outcome: "rejected", error: "request_id_mismatch" };
    }
    // Same delivery seen before (e.g. crash between event insert and ledger
    // insert): do NOT declare duplicate yet — fall through and let the ledger
    // decide, so a missing reward is still credited exactly once.
  }

  // 3. The single monetary write. Deterministic key + composite unique index
  //    make concurrent duplicates collapse here; losers re-read and ack.
  const { id, inserted } = await store.insertLedgerReward({
    userId: profile.id,
    type: "offer_reward",
    status: "confirmed",
    amountCents: b.amountRaw,
    description: describeReward(b),
    idempotencyKey,
    provider: ADGEM_PROVIDER_KEY,
    providerTransactionId: txnRef,
    publisherRevenueCents: b.payoutCents,
    metadata: eventPayload(b),
  });
  if (!inserted) {
    const winner = await store.findRewardByTxnRef(txnRef);
    if (winner && winner.userId === profile.id) {
      await store.markEventProcessed(b.requestId, "duplicate_processed", null);
      return { outcome: "duplicate", detail: "reward_race" };
    }
    if (winner) {
      await store.insertFraudFlag({ userId: profile.id, reason: "adgem_reward_user_mismatch", severity: "high" });
      return { outcome: "rejected", error: "reward_user_mismatch" };
    }
    // Uniqueness conflict but no row visible: do NOT ack as processed —
    // throw so the caller returns 500 and AdGem retries safely.
    throw new Error("ledger conflict without visible row");
  }

  // 4. Money is durable — only now mark the event successfully processed.
  //    If THIS throws, the retry finds the ledger row and acks duplicate.
  await store.markEventProcessed(b.requestId, "processed", null);
  return { outcome: "credited", ledgerId: id };
}
