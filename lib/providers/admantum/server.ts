import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { isUuid } from "@/lib/providers/theoremreach/shared";
import { isAdmantumOfferId, isAdmantumTransactionId } from "./amounts";

function appId(): string | null {
  const value = process.env.ADMANTUM_APP_ID?.trim();
  return value && /^[0-9]+$/.test(value) ? value : null;
}

function secretKey(): string | null {
  return process.env.ADMANTUM_SECRET_KEY?.trim() || null;
}

export function isAdmantumConfigured(): boolean {
  return appId() !== null && secretKey() !== null;
}

export function isAdmantumPostbackEnabled(): boolean {
  return process.env.ADMANTUM_POSTBACK_ENABLED === "true" && isAdmantumConfigured();
}

export function isAdmantumRewardProcessingEnabled(): boolean {
  // The documented MD5 does not cover status or transaction_id. Keep money
  // disabled until an additional provider-authenticated binding is confirmed.
  return (
    process.env.ADMANTUM_REWARD_PROCESSING_ENABLED === "true" &&
    process.env.ADMANTUM_AUTHENTICITY_CONFIRMED === "true"
  );
}

export function isAdmantumWallEnabledForUser(userId: string | null): boolean {
  return process.env.ADMANTUM_ENABLED === "true" && appId() !== null && isUuid(userId);
}

export function buildAdmantumWallUrl(userId: string): string {
  const configuredAppId = appId();
  if (!configuredAppId || !isUuid(userId)) throw new Error("AdMantum wall is not configured.");
  const url = new URL("https://www.admantum.com/offers");
  url.searchParams.set("appid", configuredAppId);
  url.searchParams.set("uid", userId);
  return url.toString();
}

/** Official contract: MD5(uid + of_id + virtual_currency + Secret Key). */
export function admantumCallbackHash(userId: string, offerId: string, virtualCurrency: string): string {
  const secret = secretKey();
  if (!secret) throw new Error("AdMantum signing is not configured.");
  return createHash("md5").update(userId + offerId + virtualCurrency + secret, "utf8").digest("hex");
}

export function verifyAdmantumCallback(input: {
  userId: string;
  offerId: string;
  virtualCurrency: string;
  transactionId: string;
  hash: string;
}): boolean {
  if (!secretKey() || !isUuid(input.userId) || !isAdmantumOfferId(input.offerId)) return false;
  if (!isAdmantumTransactionId(input.transactionId) || !/^(?:0|[1-9][0-9]{0,8})$/.test(input.virtualCurrency)) return false;
  if (!/^[a-f0-9]{32}$/i.test(input.hash)) return false;
  const expected = Buffer.from(admantumCallbackHash(input.userId, input.offerId, input.virtualCurrency), "ascii");
  const provided = Buffer.from(input.hash, "ascii");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
