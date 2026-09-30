import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * TimeWall postback — SERVER-ONLY. Contains secret handling.
 * Never import this module (directly or transitively) from client components.
 *
 * Signature algorithm, per publisher-supplied TimeWall documentation:
 *   SHA256(userID + revenue + SecretKey)
 * where userID and revenue are the EXACT raw query strings as received
 * ("0.5" must remain "0.5", never reformatted to "0.50"). The hex digest is
 * compared timing-safe. Hex comparison is case-insensitive on the received
 * value (normalized to lowercase before comparing).
 */

function postbackSecret(): string | null {
  const secret = process.env.TIMEWALL_POSTBACK_SECRET;
  // Note: no .trim() — the secret is used byte-exactly as configured.
  return secret ? secret : null;
}

export function isTimewallConfigured(): boolean {
  return postbackSecret() !== null && process.env.TIMEWALL_POSTBACK_ENABLED === "true";
}

/**
 * Verify the `hash` query parameter.
 * @param useridRaw  exact `userid` query string (restricted charset, so raw == decoded)
 * @param revenueRaw exact `revenue` query string (restricted charset, so raw == decoded)
 */
export function verifyTimewallHash(useridRaw: string, revenueRaw: string, receivedHash: string): boolean {
  try {
    const secret = postbackSecret();
    if (!secret) return false;
    if (typeof receivedHash !== "string") return false;
    const normalized = receivedHash.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) return false;
    const expected = createHash("sha256").update(useridRaw + revenueRaw + secret, "utf8").digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(normalized, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
