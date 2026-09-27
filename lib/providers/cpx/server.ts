import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * CPX Research — SERVER-ONLY. Contains secret handling.
 * Never import this module (directly or transitively) from client components.
 *
 * !!! CPX publisher dashboard (Postback Settings), authoritative definition:
 *   wall:     MD5("{ext_user_id}-{app_secure_hash}")
 *   postback: MD5("{trans_id}-{app_secure_hash}")
 * Do not alter these formulas without updated CPX documentation.
 */

export const CPX_WALL_BASE_URL = "https://offers.cpx-research.com/index.php";

export function cpxAppId(): string {
  // App ID is public (it appears in the wall URL). Default matches our CPX app.
  return process.env.CPX_APP_ID?.trim() || "36592";
}

/** The single CPX application secret. Server-only. Never log, never send to browser. */
function cpxAppSecret(): string | null {
  return process.env.CPX_APP_SECURE_HASH?.trim() || null;
}

/**
 * Postback verification secret. CPX uses the same application secret for
 * postbacks, so this falls back to CPX_APP_SECURE_HASH unless a dedicated
 * CPX_POSTBACK_SECRET is configured.
 */
function cpxPostbackSecret(): string | null {
  return process.env.CPX_POSTBACK_SECRET?.trim() || cpxAppSecret();
}

export function isCpxConfigured(): boolean {
  return cpxAppSecret() !== null && process.env.CPX_POSTBACK_ENABLED === "true";
}

/** Per-user wall hash. CONFIRM formula with CPX docs. */
export function cpxWallHash(extUserId: string): string {
  const secret = cpxAppSecret();
  if (!secret) throw new Error("CPX is not configured (CPX_APP_SECURE_HASH).");
  if (!extUserId) throw new Error("ext_user_id is required to build the CPX wall URL.");
  return createHash("md5").update(`${extUserId}-${secret}`, "utf8").digest("hex");
}

export interface BuildWallInput {
  /** Stable auth UUID from trusted server session. Never browser-chosen. */
  extUserId: string;
  email?: string | null;
  subId1?: string;
  subId2?: string;
}

/**
 * Build the authenticated CPX SurveyWall URL. The result contains the per-user
 * hash (required by CPX) but NEVER the underlying application secret.
 */
export function buildSurveyWallUrl(input: BuildWallInput): string {
  const hash = cpxWallHash(input.extUserId);
  const params = new URLSearchParams({
    app_id: cpxAppId(),
    ext_user_id: input.extUserId,
    secure_hash: hash,
  });
  if (input.email) params.set("email", input.email);
  params.set("subid_1", input.subId1 ?? "");
  params.set("subid_2", input.subId2 ?? "");
  return `${CPX_WALL_BASE_URL}?${params.toString()}`;
}

/** Expected postback signature per CPX Postback Settings: MD5("{transId}-{secret}"). */
export function expectedPostbackHash(transId: string): string {
  const secret = cpxPostbackSecret();
  if (!secret) throw new Error("CPX is not configured (CPX_APP_SECURE_HASH).");
  return createHash("md5").update(`${transId}-${secret}`, "utf8").digest("hex");
}

/** Timing-safe postback authenticity check. Returns false when unconfigured (fail closed). */
export function verifyPostbackHash(transId: string, providedHash: string): boolean {
  try {
    const expected = expectedPostbackHash(transId);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(providedHash ?? "").toLowerCase(), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
