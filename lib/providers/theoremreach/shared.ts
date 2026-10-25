/**
 * TheoremReach — shared, CLIENT-SAFE parsing and validation.
 * No secrets here. Callback URL signature verification lives in ./server.ts
 * (server-only); this module only validates its fields. Phase 1 still fails
 * closed after a valid signature (see the postback route).
 *
 * Supplied dashboard contract (authoritative for field names):
 * - reward:   reward amount in app currency (user's share)
 * - currency: USD amount paid for the transaction (publisher revenue)
 * - user_id:  external Freearn user ID supplied on entry
 * - tx_id:    unique TheoremReach reward transaction ID
 * - transaction_id: optional entry/session ID; never a reward deduplication key
 * - hash:     callback signature (payload formula UNPROVEN — never trusted)
 * - reversal: optional "true" for a reversal / negative transaction
 * - debug:    optional; debug=true MUST be completely ignored
 * - status:   DEPRECATED — must never drive reward decisions
 *
 * Phase 1 rule: nothing in this file can write money. The pure mapping
 * helpers below document the INTENDED Phase 2 money model only; no runtime
 * processing path may call them to credit or debit.
 */

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Identifier charset (mirrors CPX/AdGem convention). */
export function isReasonableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_:.-]+$/.test(value)
  );
}

/** Exact documented opt-out: only the literal value "true" ignores. */
export function isDebugTrue(value: unknown): boolean {
  return value === "true";
}

/** Exact documented reversal flag: only the literal value "true". */
export function isReversalTrue(value: unknown): boolean {
  return value === "true";
}

export interface TheoremreachCallbackFields {
  rewardRaw: unknown;
  currencyRaw: unknown;
  userId: unknown;
  txId: unknown;
  transactionId: unknown;
  hash: unknown;
  reversalRaw: unknown;
  debugRaw: unknown;
}

export function readCallbackFields(get: (name: string) => string | null): TheoremreachCallbackFields {
  return {
    rewardRaw: get("reward"),
    currencyRaw: get("currency"),
    userId: get("user_id"),
    txId: get("tx_id"),
    transactionId: get("transaction_id"),
    hash: get("hash"),
    reversalRaw: get("reversal"),
    debugRaw: get("debug"),
  };
}

/**
 * Reward identity is exclusively `tx_id`. `transaction_id` identifies the
 * entry/session and must never be used to deduplicate reward callbacks.
 */
export function callbackTxId(f: Pick<TheoremreachCallbackFields, "txId" | "transactionId">): string | null {
  if (isReasonableId(f.txId)) return f.txId;
  return null;
}

/**
 * INTENDED Phase 2 mapping (DOCUMENT ONLY — no active credit path may use
 * these to write money in Phase 1):
 * Exchange Rate 70 + cent/cents property ⇒ `reward` already IS user cents.
 * reward=70 → 70¢. NEVER apply another 70% multiplier (that would credit
 * 49¢). Only positive integers within cap are creditable.
 */
export const THEOREMREACH_MAX_REWARD_CENTS = 1_000_000;
/** publisher_revenue_cents is a PostgreSQL int in the existing ledger schema. */
export const THEOREMREACH_MAX_PUBLISHER_CENTS = 2_147_483_647;

export function intendedUserCents(reward: unknown): number | null {
  const value = typeof reward === "string" && /^\d+$/.test(reward) ? Number(reward) : reward;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  if (value <= 0 || value > THEOREMREACH_MAX_REWARD_CENTS) return null;
  return value;
}

export function intendedRewardCents(reward: unknown): number | null {
  return intendedUserCents(reward);
}

/**
 * Parse `currency` publisher USD into PostgreSQL integer cents using exact
 * decimal string arithmetic and half-up cent rounding. No binary float math.
 */
export function intendedPublisherCents(currency: unknown): number | null {
  const raw = typeof currency === "string" ? currency : typeof currency === "number" && Number.isFinite(currency) ? String(currency) : null;
  if (raw === null || !/^\d+(?:\.\d{1,6})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  if (whole.length > 10) return null;
  const thousandths = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
  if (!Number.isSafeInteger(thousandths)) return null;
  const cents = Math.floor((thousandths + 5) / 10);
  if (!Number.isSafeInteger(cents) || cents > THEOREMREACH_MAX_PUBLISHER_CENTS) return null;
  return cents;
}
