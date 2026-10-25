export const THEOREMREACH_PROVIDER_KEY = "theoremreach";

export interface NormalizedTheoremreachCallback {
  /** tx_id is the provider's unique reward transaction ID. */
  txId: string;
  userId: string;
  reversal: boolean;
  userRewardCents: number;
  publisherRevenueCents: number;
}

export interface TheoremreachEventInsert {
  provider: string;
  externalEventId: string;
  userId: string | null;
  externalOfferId: string | null;
  eventType: string;
  publisherRevenueCents: number;
  userRewardCents: number;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  error: string | null;
}

export interface TheoremreachEventRecord {
  userId: string | null;
  eventType: string;
  userRewardCents: number;
  publisherRevenueCents: number;
  processingStatus: string;
}

export interface TheoremreachRewardRecord {
  id: string;
  userId: string;
  amountCents: number;
  publisherRevenueCents: number;
  status: string;
}

export interface TheoremreachLedgerInsert {
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

/** Production storage relies on the existing provider_events and ledger unique indexes. */
export interface TheoremreachStore {
  findProfile(userId: string): Promise<{ id: string } | null>;
  insertProviderEvent(row: TheoremreachEventInsert): Promise<{ inserted: boolean }>;
  findProviderEvent(txId: string): Promise<TheoremreachEventRecord | null>;
  markEventProcessed(txId: string, processingStatus: string, error: string | null): Promise<void>;
  findRewardByTxId(txId: string): Promise<TheoremreachRewardRecord | null>;
  hasReversalForTxId(txId: string): Promise<boolean>;
  insertLedger(row: TheoremreachLedgerInsert): Promise<{ id: string; inserted: boolean }>;
  insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }): Promise<void>;
}

export type TheoremreachOutcome =
  | { outcome: "rewarded"; ledgerId: string }
  | { outcome: "reversed"; ledgerId: string }
  | { outcome: "duplicate" }
  | { outcome: "orphan_reversal" }
  | { outcome: "rejected"; reason: string };

function validAmounts(callback: NormalizedTheoremreachCallback): boolean {
  return Number.isSafeInteger(callback.userRewardCents) && callback.userRewardCents > 0 &&
    Number.isSafeInteger(callback.publisherRevenueCents) && callback.publisherRevenueCents >= 0;
}

function providerEvent(callback: NormalizedTheoremreachCallback, userId: string | null, processingStatus: string, error: string | null): TheoremreachEventInsert {
  const reversal = callback.reversal;
  return {
    provider: THEOREMREACH_PROVIDER_KEY,
    externalEventId: callback.txId,
    userId,
    externalOfferId: null,
    eventType: reversal ? "reversal" : "complete",
    publisherRevenueCents: reversal ? 0 : callback.publisherRevenueCents,
    userRewardCents: reversal ? 0 : callback.userRewardCents,
    rawPayload: {
      tx_id: callback.txId,
      user_id: callback.userId,
      reversal,
      ...(reversal ? {} : {
        reward_cents: callback.userRewardCents,
        publisher_revenue_cents: callback.publisherRevenueCents,
      }),
    },
    processingStatus,
    error,
  };
}

function sameReward(
  existing: TheoremreachRewardRecord | null,
  callback: NormalizedTheoremreachCallback
): boolean {
  return Boolean(
    existing && existing.status === "confirmed" && existing.userId === callback.userId &&
    existing.amountCents === callback.userRewardCents &&
    existing.publisherRevenueCents === callback.publisherRevenueCents
  );
}

async function rejectUserMismatch(store: TheoremreachStore, userId: string, reason: string): Promise<TheoremreachOutcome> {
  await store.insertFraudFlag({ userId, reason: `theoremreach_${reason}`, severity: "high" });
  return { outcome: "rejected", reason };
}

/**
 * Process only a callback already shape-checked and HMAC-verified by the route.
 * DB uniqueness remains the concurrency authority: provider_events by tx_id
 * and ledger rows by (provider, tx_id, type) plus idempotency_key.
 */
export async function processTheoremreachCallback(
  store: TheoremreachStore,
  callback: NormalizedTheoremreachCallback
): Promise<TheoremreachOutcome> {
  if (!validAmounts(callback)) return { outcome: "rejected", reason: "invalid_amount" };
  return callback.reversal
    ? processReversal(store, callback)
    : processReward(store, callback);
}

async function processReward(
  store: TheoremreachStore,
  callback: NormalizedTheoremreachCallback
): Promise<TheoremreachOutcome> {
  const profile = await store.findProfile(callback.userId);
  if (!profile) {
    await store.insertProviderEvent(providerEvent(callback, null, "rejected", "unknown_user"));
    return { outcome: "rejected", reason: "unknown_user" };
  }

  const { inserted: eventInserted } = await store.insertProviderEvent(providerEvent(callback, profile.id, "received", null));
  const existingEvent = eventInserted ? null : await store.findProviderEvent(callback.txId);
  if (!eventInserted && (!existingEvent || existingEvent.userId !== profile.id)) {
    return rejectUserMismatch(store, profile.id, "tx_id_user_mismatch");
  }

  const existingReward = await store.findRewardByTxId(callback.txId);
  if (existingReward) {
    if (!sameReward(existingReward, callback)) {
      return rejectUserMismatch(store, profile.id, "tx_id_reward_mismatch");
    }
    if (eventInserted || existingEvent?.processingStatus === "received") {
      await store.markEventProcessed(callback.txId, "duplicate_processed", null);
    }
    return { outcome: "duplicate" };
  }

  // Recover only an interrupted, matching event. A terminal event without its
  // corresponding ledger credit is inconsistent: never turn it into money.
  if (!eventInserted && (
    existingEvent?.eventType !== "complete" ||
    existingEvent.userRewardCents !== callback.userRewardCents ||
    existingEvent.publisherRevenueCents !== callback.publisherRevenueCents ||
    existingEvent.processingStatus !== "received"
  )) return { outcome: "rejected", reason: "event_without_matching_reward" };

  const inserted = await store.insertLedger({
    userId: profile.id,
    type: "survey_reward",
    status: "confirmed",
    amountCents: callback.userRewardCents,
    description: `Survey reward (TheoremReach ${callback.txId})`.slice(0, 140),
    idempotencyKey: `theoremreach:${callback.txId}:reward`,
    provider: THEOREMREACH_PROVIDER_KEY,
    providerTransactionId: callback.txId,
    publisherRevenueCents: callback.publisherRevenueCents,
    metadata: {
      tx_id: callback.txId,
      publisher_revenue_cents: callback.publisherRevenueCents,
    },
  });
  if (!inserted.inserted) {
    const racedReward = await store.findRewardByTxId(callback.txId);
    if (!sameReward(racedReward, callback)) {
      return rejectUserMismatch(store, profile.id, "tx_id_reward_race_mismatch");
    }
    await store.markEventProcessed(callback.txId, "duplicate_processed", null);
    return { outcome: "duplicate" };
  }

  await store.markEventProcessed(callback.txId, "processed", null);
  return { outcome: "rewarded", ledgerId: inserted.id };
}

async function processReversal(
  store: TheoremreachStore,
  callback: NormalizedTheoremreachCallback
): Promise<TheoremreachOutcome> {
  // tx_id must resolve to the original confirmed reward and the same user.
  // A missing/mismatched source is never translated into a debit.
  const original = await store.findRewardByTxId(callback.txId);
  if (!original || original.status !== "confirmed" || original.amountCents <= 0) {
    return { outcome: "orphan_reversal" };
  }
  if (original.userId !== callback.userId) {
    return rejectUserMismatch(store, callback.userId, "reversal_user_mismatch");
  }
  if (callback.userRewardCents !== original.amountCents) {
    return { outcome: "rejected", reason: "reversal_amount_mismatch" };
  }

  const profile = await store.findProfile(callback.userId);
  if (!profile || profile.id !== original.userId) {
    return { outcome: "rejected", reason: "reversal_user_unavailable" };
  }

  const { inserted: eventInserted } = await store.insertProviderEvent(providerEvent(callback, profile.id, "received", null));
  if (!eventInserted) {
    const existingEvent = await store.findProviderEvent(callback.txId);
    if (!existingEvent) throw new Error("Duplicate reversal event could not be read");
    if (existingEvent.userId !== original.userId) {
      return rejectUserMismatch(store, callback.userId, "reversal_event_user_mismatch");
    }
  }

  if (await store.hasReversalForTxId(callback.txId)) return { outcome: "duplicate" };
  const inserted = await store.insertLedger({
    userId: original.userId,
    type: "reversal",
    status: "confirmed",
    amountCents: -original.amountCents,
    description: `Survey reversal (TheoremReach ${callback.txId})`.slice(0, 140),
    idempotencyKey: `theoremreach:${callback.txId}:reversal`,
    provider: THEOREMREACH_PROVIDER_KEY,
    providerTransactionId: callback.txId,
    publisherRevenueCents: 0,
    metadata: { tx_id: callback.txId, reverses_ledger_id: original.id, reason: "theoremreach_callback_reversal" },
  });
  if (!inserted.inserted) return { outcome: "duplicate" };

  await store.markEventProcessed(callback.txId, "reversed", null);
  return { outcome: "reversed", ledgerId: inserted.id };
}
