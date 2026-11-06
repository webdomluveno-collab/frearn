import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { siteConfig } from "@/config/site";
import { isUuid } from "@/lib/providers/theoremreach/shared";

/**
 * TheoremReach — SERVER-ONLY. Contains secret handling.
 * Never import this module (directly or transitively) from client components.
 *
 * Entry-link signing (PROVEN by TheoremReach's official offerwall guide):
 *   HMAC-SHA1 over the complete entry URL BEFORE `hash` is appended,
 *   Base64-encoded with URL-safe substitutions (+ → -, / → _, strip =,
 *   no newlines). Secret key is used byte-exactly as configured.
 *
 * Reward callback signature: HMAC-SHA1 over the exact canonical callback URL
 * without its `hash` parameter, Base64URL encoded as above. The canonical
 * origin comes from site configuration, never from request Host headers.
 * Signature verification does not enable money processing; separate default-off
 * gates guard the Reward Callback and Event Webhook write paths.
 */

export const THEOREMREACH_ENTRY_BASE_URL = "https://theoremreach.com/respondent_entry/direct";
export const THEOREMREACH_POSTBACK_PATH = "/api/providers/theoremreach/postback";
export const THEOREMREACH_EVENT_WEBHOOK_PATH = "/api/providers/theoremreach/event-webhook";

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

/** Separate money-moving gate. Unset/false keeps verified callbacks write-free. */
export function isTheoremreachRewardProcessingEnabled(): boolean {
  return process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED === "true";
}

/** Event Webhook master switch: exact "true" plus a configured secret. */
export function isTheoremreachEventWebhookEnabled(): boolean {
  return secretKey() !== null && process.env.THEOREMREACH_EVENT_WEBHOOK_ENABLED === "true";
}

/** Separate Event Webhook write gate. Unset/false records nothing. */
export function isTheoremreachEventProcessingEnabled(): boolean {
  return process.env.THEOREMREACH_EVENT_PROCESSING_ENABLED === "true";
}

/**
 * Wall/entry availability. Fail closed unless every value required for a
 * safe signed entry URL exists. Reads env directly (never expose the secret
 * to callers — availability is a boolean only).
 */
export function isTheoremreachWallConfigured(): boolean {
  return apiKey() !== null && secretKey() !== null && placementId() !== null;
}

/**
 * Public Earn availability is a separate gate and also requires money
 * processing to be active. A user must never be sent to a live wall while a
 * completed survey cannot be credited safely.
 */
export function isTheoremreachWallEnabled(): boolean {
  return isTheoremreachWallEnabledForUser(null);
}

/** Pilot mode is opt-in and fail-closed when its UUID allowlist is empty. */
export function isTheoremreachPilotEnabled(): boolean {
  return process.env.THEOREMREACH_PILOT_ENABLED === "true";
}

/** Debug pilot mode is a non-financial wall-only mode. */
export function isTheoremreachPilotDebugEnabled(): boolean {
  return process.env.THEOREMREACH_PILOT_DEBUG_ENABLED === "true";
}

function theoremreachPilotUserIds(): Set<string> {
  return new Set(
    (process.env.THEOREMREACH_PILOT_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => isUuid(value))
  );
}

/** Only the explicitly configured UUIDs may use the pilot wall. */
export function isTheoremreachPilotUserAllowed(userId: string | null): boolean {
  return userId !== null && theoremreachPilotUserIds().has(userId.toLowerCase());
}

/** The user may receive a debug-only wall URL, never a financial callback. */
export function isTheoremreachDebugPilotUserAllowed(userId: string | null): boolean {
  return (
    isTheoremreachPilotEnabled() &&
    isTheoremreachPilotDebugEnabled() &&
    isTheoremreachPostbackEnabled() &&
    isTheoremreachPilotUserAllowed(userId)
  );
}

/**
 * User-aware Earn gate. Pilot mode takes precedence over public wall access,
 * so enabling the pilot can never accidentally expose the wall to everyone.
 * Reward processing remains mandatory in both public and pilot modes.
 */
export function isTheoremreachWallEnabledForUser(userId: string | null): boolean {
  if (!isTheoremreachPostbackEnabled() || !isTheoremreachWallConfigured()) return false;
  if (isTheoremreachDebugPilotUserAllowed(userId)) return true;
  if (!isTheoremreachRewardProcessingEnabled()) return false;
  if (isTheoremreachPilotEnabled()) return isTheoremreachPilotUserAllowed(userId);
  return process.env.THEOREMREACH_WALL_ENABLED === "true";
}

/**
 * Callback user gate. Pilot mode uses only its UUID allowlist; outside pilot
 * mode, public callback writes require the public wall gate explicitly. This
 * prevents disabling the pilot from silently opening all reward callbacks.
 */
export function isTheoremreachRewardUserAllowed(userId: string): boolean {
  if (isTheoremreachPilotEnabled()) return isTheoremreachPilotUserAllowed(userId);
  return process.env.THEOREMREACH_WALL_ENABLED === "true";
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

/** Canonical endpoint configured with TheoremReach; never derived from Host. */
export function theoremreachCallbackEndpoint(): string {
  const site = new URL(siteConfig.url);
  return `${site.origin}${THEOREMREACH_POSTBACK_PATH}`;
}

/** Canonical Event Webhook endpoint; never derived from Host. */
export function theoremreachEventWebhookEndpoint(): string {
  const site = new URL(siteConfig.url);
  return `${site.origin}${THEOREMREACH_EVENT_WEBHOOK_PATH}`;
}

/**
 * Rebuild a signed URL from the original raw request target. Preserve raw
 * query order and value encoding; remove only the single `hash` pair. The
 * request authority is intentionally discarded in favor of siteConfig.url.
 */
export function theoremreachUrlWithoutHash(requestUrl: string, expectedPath: string): string | null {
  let endpoint: URL;
  try {
    endpoint = new URL(siteConfig.url);
  } catch {
    return null;
  }
  if (!expectedPath.startsWith("/") || expectedPath.includes("?") || expectedPath.includes("#")) {
    return null;
  }

  const authority = /^https?:\/\/[^/?#]+/i.exec(requestUrl)?.[0];
  if (!authority) return null;
  const target = requestUrl.slice(authority.length);
  if (target.includes("#")) return null;
  const queryIndex = target.indexOf("?");
  const path = queryIndex < 0 ? target : target.slice(0, queryIndex);
  if (path !== expectedPath || queryIndex < 0) return null;

  const rawQuery = target.slice(queryIndex + 1);
  if (!rawQuery) return null;
  const names = new Set<string>();
  const signedPairs: string[] = [];
  let hashCount = 0;
  for (const pair of rawQuery.split("&")) {
    if (!pair) return null;
    const equalIndex = pair.indexOf("=");
    const rawName = equalIndex < 0 ? pair : pair.slice(0, equalIndex);
    const rawValue = equalIndex < 0 ? "" : pair.slice(equalIndex + 1);
    let name: string;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, " "));
      decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch {
      return null;
    }
    if (!name || names.has(name)) return null;
    names.add(name);
    if (name === "hash") {
      if (equalIndex < 0 || !rawValue) return null;
      hashCount++;
    } else {
      signedPairs.push(pair);
    }
  }
  if (hashCount !== 1) return null;
  return `${endpoint.origin}${path}${signedPairs.length ? `?${signedPairs.join("&")}` : ""}`;
}

/** Reward Callback canonical URL (legacy wrapper). */
export function theoremreachCallbackUrlWithoutHash(requestUrl: string): string | null {
  return theoremreachUrlWithoutHash(requestUrl, THEOREMREACH_POSTBACK_PATH);
}

/** Event Webhook canonical URL. */
export function theoremreachEventWebhookUrlWithoutHash(requestUrl: string): string | null {
  return theoremreachUrlWithoutHash(requestUrl, THEOREMREACH_EVENT_WEBHOOK_PATH);
}

const CALLBACK_HASH_RE = /^[A-Za-z0-9_-]{27}$/;

/** Calculate the callback URL HMAC using the server-only TheoremReach secret. */
export function theoremreachCallbackHash(unsignedCallbackUrl: string): string {
  const secret = secretKey();
  if (!secret) throw new Error("TheoremReach is not configured (THEOREMREACH_SECRET_KEY).");
  return base64UrlEncode(createHmac("sha1", secret).update(unsignedCallbackUrl, "utf8").digest());
}

/** Constant-time comparison of a canonical TheoremReach callback hash. */
export function verifyTheoremreachCallbackHash(unsignedCallbackUrl: string, suppliedHash: unknown): boolean {
  if (typeof suppliedHash !== "string" || !CALLBACK_HASH_RE.test(suppliedHash)) return false;
  const secret = secretKey();
  if (!secret) return false;
  const expected = Buffer.from(
    base64UrlEncode(createHmac("sha1", secret).update(unsignedCallbackUrl, "utf8").digest()),
    "ascii"
  );
  const supplied = Buffer.from(suppliedHash, "ascii");
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(expected, supplied);
}

export interface BuildEntryInput {
  /** Stable Supabase auth UUID from the trusted server session. Never browser-chosen. */
  userId: string;
  /**
   * Optional entry-session ID sent as `transaction_id`. The route mints a fresh
   * UUID per entry URL; this is NOT the provider reward transaction ID.
   */
  transactionId?: string;
  /** Debug-only provider acknowledgement mode; included in the signed URL. */
  debug?: boolean;
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
  if (input.debug) url.searchParams.set("debug", "true");
  const unsigned = url.toString();
  url.searchParams.set("hash", theoremreachEntryHash(unsigned));
  return url.toString();
}
