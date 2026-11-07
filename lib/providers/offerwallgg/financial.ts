import "server-only";

import { apiUnits4, isOfferwallggTxId, payoutUsdCents } from "./amounts";
import { isOfferwallggConfigured } from "./server";

export function isOfferwallggPostbackEnabled(): boolean {
  return process.env.OFFERWALLGG_POSTBACK_ENABLED === "true" && isOfferwallggConfigured();
}

export function isOfferwallggRewardProcessingEnabled(): boolean {
  return process.env.OFFERWALLGG_REWARD_PROCESSING_ENABLED === "true";
}

/**
 * The customer-facing wall can NEVER be enabled independently of financial
 * processing, the required callback secret, and the service-role DB client.
 */
export function isOfferwallggLiveEnabled(): boolean {
  return (
    process.env.OFFERWALLGG_WALL_ENABLED === "true" &&
    isOfferwallggPostbackEnabled() &&
    isOfferwallggRewardProcessingEnabled() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export interface ReconciledConversion {
  transactionId: string;
  userId: string;
  status: "pending" | "credited" | "rejected" | "reversed";
  units4: bigint;
  publisherRevenueCents: number;
  offerName: string;
}

export class OfferwallggReconciliationError extends Error {}

/**
 * The callback HMAC authenticates amount/user/tx but NOT status or payoutUsd.
 * Check current provider status and revenue against the authenticated API.
 * Fails closed on API lag/HTTP errors; the provider retries non-2xx callbacks.
 */
export async function reconcileOfferwallggConversion(txId: string): Promise<ReconciledConversion | null> {
  const publicKey = process.env.OFFERWALLGG_PUBLIC_KEY?.trim().toLowerCase();
  const secret = process.env.OFFERWALLGG_SECRET_KEY?.trim();
  if (!isOfferwallggTxId(txId) || !isOfferwallggConfigured() || !publicKey || !secret) {
    throw new OfferwallggReconciliationError("invalid_configuration");
  }

  const url = new URL("https://offerwall.gg/api/v1/conversions");
  url.searchParams.set("appId", publicKey);
  url.searchParams.set("transactionId", txId);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-Api-Key": secret, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new OfferwallggReconciliationError("api_unreachable");
  }
  if (!res.ok) throw new OfferwallggReconciliationError("api_not_ready");

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new OfferwallggReconciliationError("api_invalid_json");
  }
  if (!payload || typeof payload !== "object") throw new OfferwallggReconciliationError("api_invalid_payload");
  const body = payload as { success?: unknown; data?: { conversions?: unknown } };
  const conversions = body.data?.conversions;
  if (body.success !== true || !Array.isArray(conversions)) {
    throw new OfferwallggReconciliationError("api_invalid_payload");
  }
  if (conversions.length === 0) return null;
  if (conversions.length !== 1) throw new OfferwallggReconciliationError("api_ambiguous");

  const row = conversions[0] as Record<string, unknown>;
  if (!row || row.transactionId !== txId || typeof row.userId !== "string" ||
      !["pending", "credited", "rejected", "reversed"].includes(String(row.status))) {
    throw new OfferwallggReconciliationError("api_invalid_conversion");
  }

  // A reversed conversion may expose a NEGATIVE amount and payout, unlike
  // its original credited amount. Compare absolute signed amounts in the route.
  const rawUnits = apiUnits4(row.currencyAmount);
  const rawRevenue = typeof row.payoutUsd === "number" ? Math.abs(row.payoutUsd) : null;
  const cents = payoutUsdCents(rawRevenue);
  if (rawUnits === null || cents === null || (row.status === "credited" && rawUnits < BigInt(0))) {
    throw new OfferwallggReconciliationError("api_invalid_money");
  }

  return {
    transactionId: txId,
    userId: row.userId,
    status: row.status as ReconciledConversion["status"],
    units4: rawUnits,
    publisherRevenueCents: cents,
    offerName: typeof row.offerName === "string" ? row.offerName.slice(0, 100) : "",
  };
}
