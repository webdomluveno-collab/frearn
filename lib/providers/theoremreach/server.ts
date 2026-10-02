import "server-only";

import { createHmac, randomUUID } from "node:crypto";

/**
 * TheoremReach — SERVER-ONLY. Contains secret handling.
 * Never import this module (directly or transitively) from client components.
 *
 * Entry-link signing (PROVEN by TheoremReach's official offerwall guide):
 *   HMAC-SHA1 over the complete entry URL BEFORE `hash` is appended,
 *   Base64-encoded with URL-safe substitutions (+ → -, / → _, strip =,
 *   no newlines). Secret key is used byte-exactly as configured.
 *
 * Deliberately ABSENT: callback signature verification. The exact callback
 * signed payload (fields, order, serialization) is UNPROVEN — the
 * entry-link formula must NOT be assumed for callbacks. Phase 1 therefore
 * fails closed on every non-debug callback. Do not add a verifier without
 * dashboard-observed test vectors.
 */

export const THEOREMREACH_ENTRY_BASE_URL = "https://theoremreach.com/respondent_entry/direct";

/** Publisher configuration: $1 USD = 70 app-currency cents. */
export const THEOREMREACH_EXCHANGE_RATE = 70;
export const THEOREMREACH_CURRENCY_SINGULAR = "cent";
export const THEOREMREACH_CURRENCY_PLURAL = "cents";

function apiKey(): string | null {
  return process.env.THEOREMREACH_API_KEY?.trim() || null;
}

function secretKey(): string | null {
  return process.env.THEOREMREACH_SECRET_KEY?.trim() || null;
}

function placementId(): string | null {
  return process.env.THEOREMREACH_PLACEMENT_ID?.trim() || null;
}

/** Master switch for inbound postbacks: must be exactly "true". */
export function isTheoremreachPostbackEnabled(): boolean {
  return secretKey() !== null && process.env.THEOREMREACH_POSTBACK_ENABLED === "true";
}

/**
 * Wall/entry availability. Fail closed unless every value required for a
 * safe signed entry URL exists. Reads env directly (never expose the secret
 * to callers — availability is a boolean only).
 */
export function isTheoremreachWallConfigured(): boolean {
  return apiKey() !== null && secretKey() !== null && placementId() !== null;
}

/** URL-safe Base64 (TheoremReach substitution): + → -, / → _, strip =, no newlines. */
export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .replace(/\n/g, "");
}

/** Entry-link HMAC-SHA1 over the complete pre-hash URL. Server-only. */
export function theoremreachEntryHash(urlBeforeHash: string): string {
  const secret = secretKey();
  if (!secret) throw new Error("TheoremReach is not configured (THEOREMREACH_SECRET_KEY).");
  return base64UrlEncode(createHmac("sha1", secret).update(urlBeforeHash, "utf8").digest());
}

export interface BuildEntryInput {
  /** Stable Supabase auth UUID from the trusted server session. Never browser-chosen. */
  userId: string;
  /**
   * Unique entry transaction ID. The route mints a fresh UUID per entry URL;
   * callers may supply a fixed value ONLY for deterministic tests.
   */
  transactionId?: string;
}

/**
 * Build the signed TheoremReach direct-entry URL server-side. Parameter order
 * follows the official documentation examples. `external_id` carries the
 * user UUID (required field; exact TheoremReach-side semantics unconfirmed —
 * kept fail-open-safe because it exposes nothing beyond the UUID already
 * sent as `user_id`). The raw Secret Key NEVER appears in the output.
 */
export function buildTheoremreachEntryUrl(input: BuildEntryInput): string {
  const key = apiKey();
  const placement = placementId();
  if (!key || !placement || !secretKey()) {
    throw new Error("TheoremReach wall is not configured (api key / secret / placement).");
  }
  if (!input.userId) throw new Error("userId is required to build the TheoremReach entry URL.");
  const transactionId = input.transactionId ?? randomUUID();

  const url = new URL(THEOREMREACH_ENTRY_BASE_URL);
  url.searchParams.set("api_key", key);
  url.searchParams.set("user_id", input.userId);
  url.searchParams.set("transaction_id", transactionId);
  url.searchParams.set("currency_name_plural", THEOREMREACH_CURRENCY_PLURAL);
  url.searchParams.set("currency_name_singular", THEOREMREACH_CURRENCY_SINGULAR);
  url.searchParams.set("exchange_rate", String(THEOREMREACH_EXCHANGE_RATE));
  url.searchParams.set("external_id", input.userId);
  url.searchParams.set("partner_id", placement);
  const unsigned = url.toString();
  url.searchParams.set("hash", theoremreachEntryHash(unsigned));
  return url.toString();
}
