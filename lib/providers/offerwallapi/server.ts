import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "@/lib/providers/theoremreach/shared";

function secretKey(): string | null {
  return process.env.OFFERWALLAPI_SECRET_KEY?.trim() || null;
}

export function isOfferwallApiConfigured(): boolean {
  return secretKey() !== null;
}

export function isOfferwallApiPostbackEnabled(): boolean {
  return (
    process.env.OFFERWALLAPI_ENABLED === "true" &&
    process.env.OFFERWALLAPI_POSTBACK_ENABLED === "true" &&
    isOfferwallApiConfigured()
  );
}

/** HMAC-SHA256 over the exact concatenated subId + transId + reward values. */
export function offerwallApiSignature(subId: string, transId: string, reward: string): string {
  const secret = secretKey();
  if (!secret) throw new Error("OfferwallApi is not configured.");
  return createHmac("sha256", secret).update(subId + transId + reward, "utf8").digest("hex");
}

export function verifyOfferwallApiSignature(input: {
  subId: string;
  transId: string;
  reward: string;
  signature: string;
}): boolean {
  if (!secretKey() || !isUuid(input.subId)) return false;
  if (!/^[A-Za-z0-9_:-]{1,128}$/.test(input.transId)) return false;
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(input.reward)) return false;
  if (!/^[a-f0-9]{64}$/i.test(input.signature)) return false;
  const expected = Buffer.from(offerwallApiSignature(input.subId, input.transId, input.reward), "ascii");
  const provided = Buffer.from(input.signature, "ascii");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/** Exact-match identity helper for the future server-minted OfferwallApi URL. */
export function isExactOfferwallApiUserId(sentUserId: string, callbackSubId: string): boolean {
  return sentUserId === callbackSubId;
}
