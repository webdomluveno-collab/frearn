/**
 * TheoremReach — shared, CLIENT-SAFE parsing and validation.
 * No secrets here. There is deliberately NO callback signature verifier:
 * the exact callback signed payload is unproven, so Phase 1 fails closed
 * (see app/api/providers/theoremreach/postback/route.ts). Entry-link
 * signing lives in ./server.ts (proven formula, server-only).
 *
 * Supplied dashboard contract (authoritative for field names):
 * - reward:   reward amount in app currency (user's share)
 * - currency: USD amount paid for the transaction (publisher revenue)
 * - user_id:  external Freearn user ID supplied on entry
 * - tx_id:    unique TheoremReach callback transaction ID
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
 * Transaction identity. The dashboard contract names `tx_id` as the unique
 * callback ID while other documentation uses `transaction_id`. Do NOT assume
 * they are identical — capture both, prefer `tx_id`, and treat the mapping
 * as UNRESOLVED until a real dashboard callback is observed.
 */
export function callbackTxId(f: Pick<TheoremreachCallbackFields, "txId" | "transactionId">): string | null {
  if (isReasonableId(f.txId)) return f.txId;
  if (isReasonableId(f.transactionId)) return f.transactionId;
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

export function intendedUserCents(reward: unknown): number | null {
  if (typeof reward !== "number" || !Number.isFinite(reward)) return null;
  if (!Number.isInteger(reward) || reward <= 0 || reward > THEOREMREACH_MAX_REWARD_CENTS) return null;
  return reward;
}

/**
 * INTENDED Phase 2 mapping (DOCUMENT ONLY): `currency` is publisher USD
 * revenue as a float; stored as integer cents for audit. currency=1.00 → 100.
 */
export function intendedPublisherCents(currency: unknown): number | null {
  if (typeof currency !== "number" || !Number.isFinite(currency) || currency < 0) return null;
  const cents = Math.round(currency * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}
