import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * AdGem Server Postback v3 — SERVER-ONLY. Contains secret handling.
 * Never import this module (directly or transitively) from client components.
 *
 * Signature algorithm, quoted from the authoritative AdGem publisher
 * documentation (docs.adgem.com, "Signature Verification (v3 - POST Requests)"):
 * HMAC-SHA256 over the EXACT RAW request body bytes, keyed with the Postback
 * Key; the hex digest is compared against the `Signature` header with a
 * timing-safe comparison (their reference implementation compares the two hex
 * strings as UTF-8 buffers and returns 401 on mismatch, 200 with empty body
 * on success). This module mirrors that behavior exactly.
 */

function postbackKey(): string | null {
  const key = process.env.ADGEM_POSTBACK_KEY?.trim();
  return key ? key : null;
}

export function isAdgemConfigured(): boolean {
  return postbackKey() !== null && process.env.ADGEM_POSTBACK_ENABLED === "true";
}

/**
 * Verify the `Signature` header against the raw request body.
 * The body MUST be the exact raw text (`await req.text()`), never a
 * re-serialized object — any byte difference breaks the HMAC.
 * Returns false when unconfigured or on any mismatch (fail closed).
 */
export function verifyAdgemSignature(rawBody: string, signatureHeader: string | null): boolean {
  try {
    const key = postbackKey();
    if (!key) return false;
    if (typeof signatureHeader !== "string") return false;
    const received = signatureHeader.trim();
    if (received.length === 0 || received.length > 256) return false;
    const expected = createHmac("sha256", key).update(Buffer.from(rawBody, "utf8")).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
