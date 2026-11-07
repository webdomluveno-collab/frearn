import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "@/lib/providers/theoremreach/shared";

/**
 * Offerwall.GG preview integration. Reward processing is intentionally absent:
 * a preview link has NO userId, so offers cannot produce an attributable credit.
 * See https://offerwall.gg/developers/quickstart.
 */
function publicKey(): string | null {
  const key = process.env.OFFERWALLGG_PUBLIC_KEY?.trim().toLowerCase();
  return key && /^[a-f0-9]{32}$/.test(key) ? key : null;
}

function secretKey(): string | null {
  return process.env.OFFERWALLGG_SECRET_KEY?.trim() || null;
}

export function isOfferwallggConfigured(): boolean {
  return publicKey() !== null && secretKey() !== null;
}

export function isOfferwallggPreviewEnabled(): boolean {
  return process.env.OFFERWALLGG_PREVIEW_ENABLED === "true" && isOfferwallggConfigured();
}

/** SignedQuery: sort appId/userId/optional ts, URL-encode, HMAC-SHA256 hex. */
export function signOfferwallggQuery(params: Record<string, string>): string {
  const secret = secretKey();
  if (!secret) throw new Error("Offerwall.GG signing is not configured.");
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const canonical = new URLSearchParams(entries).toString();
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

/**
 * Preview-only URL: no userId, so Offerwall.GG refuses attributable clicks.
 * Require a valid placement and secret even for preview.
 */
export function buildOfferwallggPreviewUrl(): string {
  const key = publicKey();
  if (!key || !secretKey()) throw new Error("Offerwall.GG is not configured.");
  const signed: Record<string, string> = { appId: key };
  if (process.env.OFFERWALLGG_LINK_EXPIRY_ENABLED === "true") {
    signed.ts = String(Math.floor(Date.now() / 1000));
  }
  const params = new URLSearchParams();
  if (signed.ts) params.set("ts", signed.ts);
  params.set("signature", signOfferwallggQuery(signed));
  return "https://offerwall.gg/wall/" + key + "?" + params.toString();
}

/** Prepared for a later, independently audited money-enabled integration. */
export function buildOfferwallggSignedUserUrl(userId: string): string {
  const key = publicKey();
  if (!key || !secretKey() || !isUuid(userId)) throw new Error("Offerwall.GG user wall unavailable.");
  const signed: Record<string, string> = { appId: key, userId };
  if (process.env.OFFERWALLGG_LINK_EXPIRY_ENABLED === "true") {
    signed.ts = String(Math.floor(Date.now() / 1000));
  }
  const params = new URLSearchParams({ userId });
  if (signed.ts) params.set("ts", signed.ts);
  params.set("signature", signOfferwallggQuery(signed));
  return "https://offerwall.gg/wall/" + key + "?" + params.toString();
}

/** Exactly signed raw decimal is required (do not parseFloat before signing). */
export function verifyOfferwallggCallback(input: {
  userId: string;
  transactionId: string;
  currencyAmount: string;
  signature: string;
}): boolean {
  const secret = secretKey();
  if (!secret || !isUuid(input.userId)) return false;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(input.transactionId)) return false;
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/.test(input.currencyAmount)) return false;
  if (!/^[a-f0-9]{64}$/i.test(input.signature)) return false;
  const msg = [input.userId, input.transactionId, input.currencyAmount].join(":");
  const expected = createHmac("sha256", secret).update(msg, "utf8").digest();
  const provided = Buffer.from(input.signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
