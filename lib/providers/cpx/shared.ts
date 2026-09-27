/**
 * CPX Research — shared, CLIENT-SAFE helpers.
 * No secrets here. Anything touching the CPX application secret lives in ./server.ts.
 */

/** CPX postback status codes. CONFIRM against CPX docs (see README). */
export const CPX_STATUS_COMPLETE = "1";
export const CPX_STATUS_FRAUD = "2";
export const CPX_SUPPORTED_STATUSES = [CPX_STATUS_COMPLETE, CPX_STATUS_FRAUD] as const;
export type CpxStatus = (typeof CPX_SUPPORTED_STATUSES)[number];

/** Max accepted money value: $10,000. Anything larger is treated as malformed/abuse. */
export const CPX_MAX_CENTS = 1_000_00 * 100;

/** Max accepted transaction/offer id length. */
export const CPX_MAX_ID_LENGTH = 128;

/**
 * Parse a decimal dollar string ("1.40") into EXACT integer cents (140).
 * String math only — never parseFloat — so money is never subject to float error.
 * Returns null for malformed, negative, over-precise, or unreasonably large values.
 */
export function parseDecimalToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const dot = s.indexOf(".");
  const whole = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? "" : s.slice(dot + 1);
  if (whole.length > 7) return null; // > $9,999,999 guard before math
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > CPX_MAX_CENTS) return null;
  return cents;
}

/** Transaction/offer ids: short alphanumerics plus dash/underscore/colon. */
export function isReasonableId(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= CPX_MAX_ID_LENGTH &&
    /^[A-Za-z0-9_:.-]+$/.test(value)
  );
}

/** Our ext_user_id must be a UUID (Supabase auth.users.id). Never emails. */
export function isUuid(value: string): boolean {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export interface CpxPostbackParams {
  status: string;
  transId: string;
  extUserId: string;
  amountLocal: string;
  amountUsd: string;
  offerId: string;
  hash: string;
  subId?: string;
  subId2?: string;
  ipClick?: string;
}

/** Structural validation of required CPX postback parameters (authenticity checked separately). */
export function validatePostbackShape(p: CpxPostbackParams): { ok: true } | { ok: false; error: string } {
  if (!CPX_SUPPORTED_STATUSES.includes(p.status as CpxStatus)) return { ok: false, error: "unsupported_status" };
  if (!isReasonableId(p.transId)) return { ok: false, error: "invalid_trans_id" };
  if (!isUuid(p.extUserId)) return { ok: false, error: "invalid_user_id" };
  if (!isReasonableId(p.offerId)) return { ok: false, error: "invalid_offer_id" };
  if (typeof p.hash !== "string" || p.hash.length < 16 || p.hash.length > 128) return { ok: false, error: "invalid_hash" };
  const reward = parseDecimalToCents(p.amountLocal);
  const revenue = parseDecimalToCents(p.amountUsd);
  if (reward === null) return { ok: false, error: "invalid_amount_local" };
  if (revenue === null) return { ok: false, error: "invalid_amount_usd" };
  if (p.status === CPX_STATUS_COMPLETE && reward <= 0) return { ok: false, error: "non_positive_reward" };
  if (p.subId !== undefined && p.subId !== "" && !isReasonableId(p.subId)) return { ok: false, error: "invalid_sub_id" };
  if (p.subId2 !== undefined && p.subId2 !== "" && !isReasonableId(p.subId2)) return { ok: false, error: "invalid_sub_id_2" };
  return { ok: true };
}

export interface NormalizedCpxPostback {
  status: CpxStatus;
  transId: string;
  extUserId: string;
  /** Authoritative per-user reward from CPX (currency factor already applied by CPX). */
  userRewardCents: number;
  /** Publisher payout from CPX. */
  publisherRevenueCents: number;
  offerId: string;
  subId: string | null;
  subId2: string | null;
  ipClick: string | null;
}

/** Convert validated params into integer-cents normalized form. Call only after validatePostbackShape + hash check. */
export function normalizePostback(p: CpxPostbackParams): NormalizedCpxPostback {
  return {
    status: p.status as CpxStatus,
    transId: p.transId,
    extUserId: p.extUserId,
    userRewardCents: parseDecimalToCents(p.amountLocal) as number,
    publisherRevenueCents: parseDecimalToCents(p.amountUsd) as number,
    offerId: p.offerId,
    subId: p.subId && p.subId !== "" ? p.subId : null,
    subId2: p.subId2 && p.subId2 !== "" ? p.subId2 : null,
    ipClick: p.ipClick && p.ipClick !== "" ? p.ipClick.slice(0, 64) : null,
  };
}
