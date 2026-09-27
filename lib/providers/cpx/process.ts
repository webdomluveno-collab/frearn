import "server-only";

import {
  CPX_STATUS_COMPLETE,
  CPX_STATUS_FRAUD,
  type NormalizedCpxPostback,
} from "./shared";

export const CPX_PROVIDER_KEY = "cpx";

/** Minimal profile reference needed to credit a user. */
export interface CpxProfile {
  id: string;
}

export interface CpxRewardRow {
  id: string;
  userId: string;
  amountCents: number;
  status: string;
}

export interface CpxLedgerInsert {
  userId: string;
  type: "survey_reward" | "reversal";
  status: "confirmed";
  amountCents: number;
  description: string;
  idempotencyKey: string;
  provider: string;
  providerTransactionId: string;
  publisherRevenueCents: number;
  metadata: Record<string, unknown>;
}

export interface CpxEventInsert {
  provider: string;
  externalEventId: string;
  userId: string | null;
  externalOfferId: string;
  eventType: string;
  publisherRevenueCents: number;
  userRewardCents: number;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  error: string | null;
}

/**
 * Storage backend. Production = Supabase (lib/db/cpx-store.ts).
 * Uniqueness MUST be enforced at the database level (unique constraints),
 * so concurrent duplicate callbacks cannot double-credit.
 */
export interface CpxStore {
  findProfile(userId: string): Promise<CpxProfile | null>;
  /** Insert event; unique (provider, external_event_id). Returns inserted=false on conflict. */
  insertProviderEvent(row: CpxEventInsert): Promise<{ inserted: boolean }>;
  markEventProcessed(transId: string, processingStatus: string, error: string | null): Promise<void>;
  findRewardByTransId(transId: string): Promise<CpxRewardRow | null>;
  /** Insert ledger row; unique idempotency_key. Returns inserted=false on conflict. */
  insertLedger(row: CpxLedgerInsert): Promise<{ id: string; inserted: boolean }>;
  hasReversalForTransId(transId: string): Promise<boolean>;
  /** Raw confirmed sum (unclamped) used to detect balance-insufficient reversals. */
  getConfirmedSumCents(userId: string): Promise<number>;
  insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }): Promise<void>;
}

export type CpxOutcome =
  | { outcome: "rewarded"; ledgerId: string }
  | { outcome: "duplicate"; detail: string }
  | { outcome: "reversed"; ledgerId: string }
  | { outcome: "rejected"; error: string }
  | { outcome: "orphan_reversal"; detail: string };

/** Scrub query echo for storage: keep debugging value, drop nothing secret (query carries no secrets). */
function eventPayload(n: NormalizedCpxPostback): Record<string, unknown> {
  return {
    status: n.status,
    trans_id: n.transId,
    user_id: n.extUserId,
    amount_local_cents: n.userRewardCents,
    amount_usd_cents: n.publisherRevenueCents,
    offer_id: n.offerId,
    sub_id: n.subId,
    sub_id_2: n.subId2,
    // ipClick intentionally NOT stored (avoid unnecessary PII retention).
  };
}

/**
 * Process one verified CPX postback. Idempotent: repeated identical callbacks
 * are acknowledged without creating additional ledger entries.
 */
export async function processCpxPostback(store: CpxStore, n: NormalizedCpxPostback): Promise<CpxOutcome> {
  const profile = await store.findProfile(n.extUserId);
  if (!profile) {
    // Unknown user: record for audit, reward nothing.
    await store.insertProviderEvent({
      provider: CPX_PROVIDER_KEY,
      externalEventId: n.transId,
      userId: null,
      externalOfferId: n.offerId,
      eventType: n.status === CPX_STATUS_FRAUD ? "fraud" : "complete",
      publisherRevenueCents: n.publisherRevenueCents,
      userRewardCents: n.userRewardCents,
      rawPayload: eventPayload(n),
      processingStatus: "rejected",
      error: "unknown_user",
    });
    return { outcome: "rejected", error: "unknown_user" };
  }

  const { inserted: eventInserted } = await store.insertProviderEvent({
    provider: CPX_PROVIDER_KEY,
    externalEventId: n.transId,
    userId: profile.id,
    externalOfferId: n.offerId,
    eventType: n.status === CPX_STATUS_FRAUD ? "fraud" : "complete",
    publisherRevenueCents: n.publisherRevenueCents,
    userRewardCents: n.userRewardCents,
    rawPayload: eventPayload(n),
    processingStatus: "received",
    error: null,
  });
  const duplicateEvent = !eventInserted;

  if (n.status === CPX_STATUS_COMPLETE) {
    const existing = await store.findRewardByTransId(n.transId);
    if (existing) {
      // Same-user duplicate, or a conflicting reward row: never credit twice.
      if (existing.userId !== profile.id) {
        await store.insertFraudFlag({ userId: profile.id, reason: "cpx_trans_id_user_mismatch", severity: "high" });
        await store.markEventProcessed(n.transId, "rejected", "trans_id_user_mismatch");
        return { outcome: "rejected", error: "trans_id_user_mismatch" };
      }
      await store.markEventProcessed(n.transId, "duplicate_processed", null);
      return { outcome: "duplicate", detail: duplicateEvent ? "duplicate_event" : "reward_exists" };
    }
    const { id, inserted } = await store.insertLedger({
      userId: profile.id,
      type: "survey_reward",
      status: "confirmed",
      amountCents: n.userRewardCents,
      description: `Survey reward (CPX ${n.offerId})`,
      idempotencyKey: `cpx:${n.transId}:reward`,
      provider: CPX_PROVIDER_KEY,
      providerTransactionId: n.transId,
      publisherRevenueCents: n.publisherRevenueCents,
      metadata: { offer_id: n.offerId, sub_id: n.subId, sub_id_2: n.subId2 },
    });
    await store.markEventProcessed(n.transId, "processed", null);
    if (!inserted) return { outcome: "duplicate", detail: "reward_race" };
    return { outcome: "rewarded", ledgerId: id };
  }

  // status === CPX_STATUS_FRAUD → immutable reversal of the original reward.
  const original = await store.findRewardByTransId(n.transId);
  if (!original) {
    await store.insertFraudFlag({ userId: profile.id, reason: "cpx_orphan_reversal", severity: "medium" });
    await store.markEventProcessed(n.transId, "orphan_reversal", null);
    return { outcome: "orphan_reversal", detail: "no_original_reward" };
  }
  if (original.userId !== profile.id) {
    await store.insertFraudFlag({ userId: profile.id, reason: "cpx_trans_id_user_mismatch", severity: "high" });
    await store.markEventProcessed(n.transId, "rejected", "trans_id_user_mismatch");
    return { outcome: "rejected", error: "trans_id_user_mismatch" };
  }
  if (await store.hasReversalForTransId(n.transId)) {
    await store.markEventProcessed(n.transId, "duplicate_processed", null);
    return { outcome: "duplicate", detail: "reversal_exists" };
  }
  const { id, inserted } = await store.insertLedger({
    userId: profile.id,
    type: "reversal",
    status: "confirmed",
    amountCents: -original.amountCents,
    description: `Survey reversal (CPX ${n.offerId})`,
    idempotencyKey: `cpx:${n.transId}:reversal`,
    provider: CPX_PROVIDER_KEY,
    providerTransactionId: n.transId,
    publisherRevenueCents: 0,
    metadata: { offer_id: n.offerId, reverses_ledger_id: original.id, reason: "cpx_fraud_status_2" },
  });
  if (!inserted) {
    await store.markEventProcessed(n.transId, "duplicate_processed", null);
    return { outcome: "duplicate", detail: "reversal_race" };
  }
  // Never silently corrupt accounting: if the user already withdrew, flag for review.
  // The negative/owed state is preserved in the ledger (balances derive from it).
  const confirmedSum = await store.getConfirmedSumCents(profile.id);
  if (confirmedSum < 0) {
    await store.insertFraudFlag({ userId: profile.id, reason: "negative_balance_after_reversal", severity: "high" });
  }
  await store.markEventProcessed(n.transId, "processed", null);
  return { outcome: "reversed", ledgerId: id };
}
