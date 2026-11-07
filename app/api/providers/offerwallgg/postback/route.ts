import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/auth/server";
import { verifyOfferwallggCallback } from "@/lib/providers/offerwallgg/server";
import { decimalUnits4 } from "@/lib/providers/offerwallgg/amounts";
import {
  isOfferwallggPostbackEnabled,
  isOfferwallggRewardProcessingEnabled,
  reconcileOfferwallggConversion,
} from "@/lib/providers/offerwallgg/financial";

/**
 * Financial callbacks are gated OFF by default. Tests NEVER write balances.
 * Signed amount/user/tx are authoritative; status and payoutUsd are verified
 * against the authenticated provider Conversions API before any DB RPC.
 */
const ok = () => new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

async function handle(params: URLSearchParams, req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit("offerwallgg:" + ip, 60, 60_000)) return fail(429);

  const fields = ["userId", "transactionId", "currencyAmount", "signature", "test", "status"];
  if (fields.some((name) => params.getAll(name).length !== 1)) return fail(400);

  const f = {
    userId: params.get("userId") ?? "",
    transactionId: params.get("transactionId") ?? "",
    currencyAmount: params.get("currencyAmount") ?? "",
    signature: params.get("signature") ?? "",
    status: params.get("status") ?? "",
    test: params.get("test") ?? "",
  };
  if (f.test !== "1" && f.test !== "0") return fail(400);
  if (!verifyOfferwallggCallback(f)) return fail(403);

  // Dashboard test postback is acknowledged, but no credits, no DB reads/writes.
  if (f.test === "1") {
    return process.env.OFFERWALLGG_TEST_POSTBACK_ENABLED === "true" ? ok() : fail(503);
  }
  if (!isOfferwallggPostbackEnabled() || !isOfferwallggRewardProcessingEnabled()) return fail(503);

  const units4 = decimalUnits4(f.currencyAmount);
  if (units4 === null) return fail(400);
  if (!["credited", "reversed"].includes(f.status)) return fail(400);
  if ((f.status === "credited" && units4 < BigInt(0)) || (f.status === "reversed" && units4 > BigInt(0))) {
    return fail(400);
  }

  try {
    const conversion = await reconcileOfferwallggConversion(f.transactionId);
    if (!conversion || conversion.userId !== f.userId) return fail(503);
    if (conversion.units4 !== units4 && conversion.units4 !== -units4) return fail(503);
    if (conversion.status === "pending") return fail(503);
    if (conversion.status === "rejected") return fail(422);
    // Do not allow an unsigned "reversed" status to charge back an
    // existing conversion while the provider still says credited.
    if (f.status === "reversed" && conversion.status !== "reversed") return fail(503);

    const db = getSupabaseAdmin();
    async function record(status: "credited" | "reversed", signedUnits4: bigint) {
      const { data, error } = await db.rpc("process_offerwallgg_conversion", {
        p_user_id: f.userId,
        p_tx_id: f.transactionId,
        p_status: status,
        p_units4: signedUnits4.toString(),
        p_publisher_revenue_cents: conversion!.publisherRevenueCents,
        p_offer_name: conversion!.offerName,
      });
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error("offerwallgg_rpc_failed");
      }
    }

    if (conversion.status === "reversed" && f.status === "credited") {
      // Provider current state is reversed, but we got a late old credit
      // callback. Hold the reversal first; then record the now-voided credit.
      // Any failure causes retry, keeping the sequence replay-safe.
      await record("reversed", -((units4 < BigInt(0)) ? -units4 : units4));
      await record("credited", units4);
    } else {
      await record(f.status as "credited" | "reversed", units4);
    }
    return ok();
  } catch {
    // Only a completed database transaction may be acknowledged. Provider retries.
    return fail(503);
  }
}

export async function GET(request: Request) {
  return handle(new URL(request.url).searchParams, request);
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/x-www-form-urlencoded")) return fail(415);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 16_384) return fail(413);
  try {
    const body = await request.text();
    if (body.length > 16_384) return fail(413);
    return handle(new URLSearchParams(body), request);
  } catch {
    return fail(400);
  }
}
