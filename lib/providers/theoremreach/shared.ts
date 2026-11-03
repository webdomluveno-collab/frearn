/**
 * TheoremReach — shared, CLIENT-SAFE parsing and validation.
 * No secrets here. Callback URL signature verification lives in ./server.ts
 * (server-only); this module only validates its fields. Money writes remain
 * behind separate default-off server gates in the callback routes.
 *
 * Official field contract:
 * - reward:   reward amount in app currency (user's share)
 * - currency: USD amount paid for the transaction (publisher revenue)
 * - user_id:  external Freearn user ID supplied on entry
 * - tx_id:    provider's unique reward transaction ID (reward idempotency key)
 * - transaction_id: optional publisher entry-session ID; never a reward key
 * - hash:     callback signature (payload formula UNPROVEN — never trusted)
 * - reversal: optional "true" for a reversal / negative transaction
 * - debug:    optional; debug=true MUST be completely ignored
 * - status:   DEPRECATED — must never drive reward decisions
 *
 * Nothing in this file can write money. The pure mapping helpers below are
 * used only by the gated reward path.
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

/** Provider-generated Event Webhook id: opaque, bounded, no whitespace/control. */
export function isEventId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
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
 * Provider reward identity. TheoremReach's dashboard confirms `tx_id` is the
 * unique reward transaction ID; it is the only key used for reward
 * idempotency. `transaction_id` is an optional entry-session ID and may have a
 * different value, so it must never be used as a fallback reward key.
 */
export function callbackRewardTxId(f: Pick<TheoremreachCallbackFields, "txId">): string | null {
  return isReasonableId(f.txId) ? f.txId : null;
}

/**
 * Optional publisher entry-session ID. Returns null when absent or malformed;
 * callers that need to distinguish "absent" from "invalid" must validate the
 * raw field separately. This value is for audit/session correlation only and
 * never participates in reward idempotency.
 */
export function callbackEntryTransactionId(
  f: Pick<TheoremreachCallbackFields, "transactionId">
): string | null {
  return isReasonableId(f.transactionId) ? f.transactionId : null;
}

/**
 * Reward mapping used only after the route's default-off processing gate:
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
