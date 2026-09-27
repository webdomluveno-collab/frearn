/**
 * AdGem Server Postback v3 — shared, CLIENT-SAFE validation.
 * No secrets here. Signature handling lives in ./server.ts.
 *
 * Field semantics below are quoted from the authoritative AdGem publisher
 * documentation (docs.adgem.com, "Server-to-Server Postbacks (v3)"):
 * - request_id: "A unique ID for this postback request"
 * - timestamp: "Unix timestamp (seconds since epoch) of when the postback was sent"
 * - data.amount: "The amount of virtual currency to reward the user" (NOT money)
 * - data.payout: "The decimal amount of revenue earned" (publisher revenue, USD)
 * - data.conversion_id: "The unique AdGem ID of the offer conversion"
 * - data.player_id: "The unique ID of the player/user on your system"
 * - data.conversion_type: "reward" for rewarded goals, "install" (amount 0,
 *   tracking only, never rewarded) for install goals.
 * - data.goal_id: "the unique ID of each goal in a campaign/offer"
 *
 * CONFIRMED MONEY MAPPING (publisher property config: Virtual Currency
 * cent/cents, Currency Multiplier 70, Decimal Values Rounded): AdGem defines
 * the multiplier as "amount of virtual currency to give user for every $1
 * earned", so for THIS property `data.amount` arrives as whole USD cents of
 * the user's reward (amount:35 → +35¢). Freearn applies NO further math —
 * no second multiplier, no division. If the property configuration ever
 * changes, this mapping MUST be revisited before crediting.
 */

export const ADGEM_SUPPORTED_CONVERSION_TYPES = ["reward", "install"] as const;
export type AdgemConversionType = (typeof ADGEM_SUPPORTED_CONVERSION_TYPES)[number];

/**
 * Safety cap for a single credited conversion: $10,000 (mirrors the CPX cap).
 * Anything larger is rejected as malformed/abuse rather than credited.
 */
export const ADGEM_MAX_REWARD_CENTS = 1_000_000;

/** Identifier charset (mirrors CPX convention): short, no whitespace/control chars. */
export function isReasonableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_:.-]+$/.test(value)
  );
}

/** player_id must be a Supabase auth UUID. Never emails, never created from postbacks. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export interface AdgemPostbackBody {
  requestId: string;
  timestamp: number;
  conversionId: string;
  playerId: string;
  conversionType: string;
  /** Raw virtual-currency units as sent. NEVER treated as money. */
  amountRaw: number;
  /** Publisher revenue in USD cents (from payout_cents). Audit only. */
  payoutCents: number;
  offerId: string | null;
  goalId: string | null;
  goalName: string | null;
  offerName: string | null;
  campaignId: string | null;
  allGoalsCompleted: boolean | null;
}

/**
 * Credit-grade amount check: the Rounded property config sends whole units,
 * so only integers are accepted for crediting. Returns null otherwise.
 */
function toCreditableAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  if (!Number.isInteger(value)) return null;
  return value;
}

/**
 * Stable conversion reference for ledger traceability + idempotency.
 * Composite (conversion:goal) so distinct goals of one conversion never
 * collapse — NEVER use bare offer_id. Mirrors the DB composite unique index
 * (provider, provider_transaction_id, type).
 */
export function adgemTxnRef(conversionId: string, goalId: string | null): string {
  return goalId ? `${conversionId}:${goalId}` : conversionId;
}

/** Deterministic idempotency key for one AdGem reward credit. */
export function adgemRewardKey(conversionId: string, goalId: string | null): string {
  return `adgem:${adgemTxnRef(conversionId, goalId)}:reward`;
}

function toOptionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value).slice(0, 128);
  if (typeof value === "string" && value.length <= 128) return value;
  return null;
}

/**
 * Structural validation of a parsed v3 JSON body.
 * Returns the normalized body or a machine-readable error (never throws on input).
 */
export function validateAdgemBody(input: unknown): { ok: true; body: AdgemPostbackBody } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "body_not_object" };
  }
  const root = input as Record<string, unknown>;
  if (!isReasonableId(root.request_id)) return { ok: false, error: "invalid_request_id" };
  if (typeof root.timestamp !== "number" || !Number.isFinite(root.timestamp) || root.timestamp < 0) {
    return { ok: false, error: "invalid_timestamp" };
  }
  const data = root.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "missing_data" };
  }
  const d = data as Record<string, unknown>;
  if (!isReasonableId(d.conversion_id)) return { ok: false, error: "invalid_conversion_id" };
  if (typeof d.player_id !== "string" || !isUuid(d.player_id)) return { ok: false, error: "invalid_player_id" };
  if (typeof d.conversion_type !== "string" || d.conversion_type === "") {
    return { ok: false, error: "missing_conversion_type" };
  }
  const amount = toCreditableAmount(d.amount);
  if (amount === null) return { ok: false, error: "invalid_amount" };
  if (amount > ADGEM_MAX_REWARD_CENTS) return { ok: false, error: "amount_out_of_range" };
  let payoutCents = 0;
  if (d.payout_cents !== undefined && d.payout_cents !== null) {
    if (typeof d.payout_cents !== "number" || !Number.isInteger(d.payout_cents) || d.payout_cents < 0) {
      return { ok: false, error: "invalid_payout_cents" };
    }
    payoutCents = d.payout_cents;
  }
  return {
    ok: true,
    body: {
      requestId: root.request_id as string,
      timestamp: root.timestamp as number,
      conversionId: d.conversion_id as string,
      playerId: d.player_id as string,
      conversionType: d.conversion_type as string,
      amountRaw: amount,
      payoutCents,
      offerId: toOptionalId(d.offer_id) ?? toOptionalId(d.campaign_id),
      goalId: toOptionalId(d.goal_id),
      goalName: typeof d.goal_name === "string" ? d.goal_name.slice(0, 128) : null,
      offerName: typeof d.offer_name === "string" ? d.offer_name.slice(0, 128) : null,
      campaignId: toOptionalId(d.campaign_id),
      allGoalsCompleted: typeof d.all_goals_completed === "boolean" ? d.all_goals_completed : null,
    },
  };
}
