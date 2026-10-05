/**
 * TimeWall postback — shared, CLIENT-SAFE validation.
 * No secrets here. Signature handling lives in ./server.ts.
 *
 * Postback template (publisher-supplied):
 *   ?userid={userID}&txid={transactionID}&revenue={revenue}
 *   &currency={currencyAmount}&hash={hash}&ip={ip}&type={type}
 *   &withdrawid={withdrawid}&reason={reason}&offername={offername}
 *   &offerdetail={offerdetail}
 *
 * CONFIRMED MONEY MAPPING (publisher placement config: Currency=cents,
 * Decimals=No, conversion rate 70; dashboard demonstrates $1.00 revenue ->
 * 70 cents to user): `currency` arrives as whole USD cents of the user's
 * reward (currency=70 -> +70¢). Freearn applies NO further math — no second
 * multiplier, no division. `revenue` is publisher revenue in decimal dollars.
 * If the placement configuration ever changes, this mapping MUST be revisited.
 *
 * UNPROVEN: individual `type` values (earn vs reversal/chargeback). No public
 * TimeWall postback documentation is reachable (site is Cloudflare-blocked)
 * and no training-data certainty exists, so monetary crediting is gated on an
 * explicit allowlist that ships EMPTY (see process.ts). Verified events with
 * unconfirmed types are stored durably as held — never credited, never dropped.
 */

/** Safety cap for a single credited conversion: $10,000 (mirrors CPX/AdGem caps). */
export const TIMEWALL_MAX_REWARD_CENTS = 1_000_000;

/** Max accepted id/param length. */
export const TIMEWALL_MAX_ID_LENGTH = 128;

/** Identifier charset: short alphanumerics plus dash/underscore/colon/dot. */
export function isReasonableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= TIMEWALL_MAX_ID_LENGTH &&
    /^[A-Za-z0-9_:.-]+$/.test(value)
  );
}

/**
 * Normalize a callback `type` for allowlist comparison: trim whitespace and
 * lowercase ("Credit" -> "credit", " CREDIT " -> "credit"). Normalization
 * applies ONLY to the type comparison — no money field is ever reinterpreted,
 * and unknown types are never mapped to anything creditable. The raw value is
 * preserved separately (see NormalizedTimewallPostback.typeRaw).
 */
export function normalizeTimewallType(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** userid must be a Supabase auth UUID. Never emails, never created from postbacks. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * Parse a decimal dollar string ("1.00", "0.5", "0.002") into EXACT integer cents.
 * String math only — never parseFloat — so money is never subject to float error.
 * Up to 6 decimals accepted, rounded half-up. Sub-cent values round to 0 exactly.
 * Returns null for malformed, negative, over-precise, or unreasonably large values.
 */
export function parseRevenueToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return null;
  const dot = s.indexOf(".");
  const whole = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? "" : s.slice(dot + 1);
  if (whole.length > 7) return null; // > $9,999,999 guard before math
  // Exact thousandths from the first 3 fraction digits, zero-padded;
  // round half-up to cents (equivalent to true half-up for non-negative values).
  const thousandths = Number(whole) * 1000 + Number((frac + "000").slice(0, 3));
  if (!Number.isSafeInteger(thousandths)) return null;
  const cents = Math.floor((thousandths + 5) / 10);
  if (cents > TIMEWALL_MAX_REWARD_CENTS) return null;
  return cents;
}

/**
 * Parse the `currency` user-reward field. Placement config (Currency=cents,
 * Decimals=No) means whole integer cents only — no decimals, no floats.
 */
export function parseCurrencyToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  if (s.length > 7) return null;
  const cents = Number(s);
  if (!Number.isSafeInteger(cents) || cents > TIMEWALL_MAX_REWARD_CENTS) return null;
  return cents;
}

export interface TimewallPostbackParams {
  userid: string;
  txid: string;
  /** EXACT raw string as received — used for signature verification, never reformatted. */
  revenueRaw: string;
  currencyRaw: string;
  hash: string;
  type: string;
  ip?: string;
  withdrawid?: string;
  reason?: string;
  offername?: string;
  offerdetail?: string;
}

export interface NormalizedTimewallPostback {
  userid: string;
  txid: string;
  /** Exact raw revenue string (for audit; signature was computed over this). */
  revenueRaw: string;
  /** Publisher revenue in integer cents, parsed with exact decimal math. */
  revenueCents: number;
  /** User reward in integer cents, taken VERBATIM from `currency` (no multiplier). */
  userRewardCents: number;
  /**
   * Normalized event type (trimmed + lowercased) for allowlist comparison.
   * Only explicitly allowlisted normalized values may credit.
   */
  type: string;
  /** EXACT raw `type` string as received, for audit. Never used for credit decisions. */
  typeRaw: string;
  withdrawid: string | null;
  reason: string | null;
  offername: string | null;
  offerdetail: string | null;
}

/** Structural validation (authenticity is checked separately via hash). */
export function validatePostbackShape(p: TimewallPostbackParams): { ok: true } | { ok: false; error: string } {
  if (!isUuid(p.userid)) return { ok: false, error: "invalid_userid" };
  if (!isReasonableId(p.txid)) return { ok: false, error: "invalid_txid" };
  if (typeof p.revenueRaw !== "string" || !/^\d+(\.\d{1,6})?$/.test(p.revenueRaw.trim())) {
    return { ok: false, error: "invalid_revenue" };
  }
  if (parseRevenueToCents(p.revenueRaw) === null) return { ok: false, error: "invalid_revenue" };
  if (parseCurrencyToCents(p.currencyRaw) === null) return { ok: false, error: "invalid_currency" };
  if (typeof p.hash !== "string" || !/^[0-9a-f]{64}$/i.test(p.hash.trim())) {
    return { ok: false, error: "invalid_hash" };
  }
  if (typeof p.type !== "string" || p.type === "" || p.type.length > TIMEWALL_MAX_ID_LENGTH) {
    return { ok: false, error: "missing_type" };
  }
  return { ok: true };
}

/** Convert validated params into normalized form. Call only after shape + hash check. */
export function normalizePostback(p: TimewallPostbackParams): NormalizedTimewallPostback {
  const opt = (v: string | undefined, max: number): string | null => {
    if (typeof v !== "string" || v === "") return null;
    return v.slice(0, max);
  };
  return {
    userid: p.userid,
    txid: p.txid,
    revenueRaw: p.revenueRaw,
    revenueCents: parseRevenueToCents(p.revenueRaw) as number,
    userRewardCents: parseCurrencyToCents(p.currencyRaw) as number,
    type: normalizeTimewallType(p.type),
    typeRaw: p.type,
    withdrawid: opt(p.withdrawid, 128),
    reason: opt(p.reason, 256),
    offername: opt(p.offername, 128),
    offerdetail: opt(p.offerdetail, 256),
  };
}
