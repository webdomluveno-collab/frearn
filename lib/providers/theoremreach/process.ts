export const THEOREMREACH_PROVIDER_KEY = "theoremreach";

export interface NormalizedTheoremreachCallback {
  txId: string;
  userId: string;
  reversal: boolean;
  userRewardCents: number;
  publisherRevenueCents: number;
}

export interface TheoremreachStore {
  /** One PostgreSQL RPC call: event + ledger reward are one transaction. */
  processRewardAtomically(callback: NormalizedTheoremreachCallback): Promise<{
    outcome: "rewarded" | "duplicate";
    ledgerId: string;
  }>;
}

export type TheoremreachOutcome =
  | { outcome: "rewarded" | "duplicate"; ledgerId: string }
  | { outcome: "reversal_disabled" }
  | { outcome: "rejected"; reason: string };

/**
 * Called only after route-level HMAC and amount validation. Reversals remain
 * disabled until TheoremReach confirms whether they arrive via Reward Callback
 * or the separate Event Webhook.
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
  return store.processRewardAtomically(callback);
}
