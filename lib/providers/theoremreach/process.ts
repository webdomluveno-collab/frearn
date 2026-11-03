export const THEOREMREACH_PROVIDER_KEY = "theoremreach";

export interface NormalizedTheoremreachCallback {
  txId: string;
  userId: string;
  reversal: boolean;
  userRewardCents: number;
  publisherRevenueCents: number;
}

export interface NormalizedTheoremreachReversal {
  /** Event Webhook `enc_salt`: unique provider event id. */
  eventId: string;
  userId: string;
  txId: string;
  rawPayload: Record<string, unknown>;
}

export interface NormalizedTheoremreachBan {
  /** Event Webhook `enc_salt`: unique provider event id. */
  eventId: string;
  userId: string;
  reason: string;
  rawPayload: Record<string, unknown>;
}

export interface TheoremreachStore {
  /** One PostgreSQL RPC call: event + ledger reward are one transaction. */
  processRewardAtomically(callback: NormalizedTheoremreachCallback): Promise<
    | { outcome: "rewarded" | "duplicate"; ledgerId: string }
    | { outcome: "reversal_pending"; ledgerId: null }
  >;
  /** One reversed transaction: event + negative ledger row are one transaction. */
  processReversalAtomically(reversal: NormalizedTheoremreachReversal): Promise<
    | { outcome: "reversed" | "duplicate"; ledgerId: string }
    | { outcome: "orphan_reversal"; ledgerId: null }
  >;
  /** Ban events are non-financial but idempotent. */
  processBanAtomically(ban: NormalizedTheoremreachBan): Promise<{
    outcome: "banned" | "duplicate";
  }>;
}

export type TheoremreachOutcome =
  | { outcome: "rewarded" | "duplicate"; ledgerId: string }
  | { outcome: "reversal_pending" }
  | { outcome: "reversal_disabled" }
  | { outcome: "rejected"; reason: string };

/**
 * Called only after route-level HMAC and amount validation. Reversals in the
 * Reward Callback remain disabled; the official reversal path is the separate
 * Event Webhook.
 */
export async function processTheoremreachCallback(
  store: TheoremreachStore,
  callback: NormalizedTheoremreachCallback
): Promise<TheoremreachOutcome> {
  if (callback.reversal) return { outcome: "reversal_disabled" };
  if (!Number.isSafeInteger(callback.userRewardCents) || callback.userRewardCents <= 0) {
    return { outcome: "rejected", reason: "invalid_amount" };
  }
  if (!Number.isSafeInteger(callback.publisherRevenueCents) || callback.publisherRevenueCents < 0) {
    return { outcome: "rejected", reason: "invalid_revenue" };
  }
  const result = await store.processRewardAtomically(callback);
  if (result.outcome === "reversal_pending") return { outcome: "reversal_pending" };
  return result;
}
