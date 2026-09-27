import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/auth/server";
import {
  normalizePostback,
  validatePostbackShape,
  type CpxPostbackParams,
} from "@/lib/providers/cpx/shared";
import { isCpxConfigured, verifyPostbackHash } from "@/lib/providers/cpx/server";
import { processCpxPostback } from "@/lib/providers/cpx/process";
import { SupabaseCpxStore } from "@/lib/db/cpx-store";

/**
 * CPX Research server-to-server postback (server-only).
 *
 * Pipeline: rate limit → configured? → shape validation → signature check
 * → user lookup → idempotent ledger insert → acknowledge.
 * FAILS CLOSED: unverified or malformed callbacks never create rewards.
 *
 * Responses are plain-text "1" (accepted) / "0" (rejected) per CPX convention.
 * !!! CONFIRM the expected response body with CPX docs (see README). !!!
 */

const querySchema = z.object({
  status: z.string(),
  trans_id: z.string(),
  user_id: z.string(),
  amount_local: z.string(),
  amount_usd: z.string(),
  offer_id: z.string(),
  hash: z.string(),
  sub_id: z.string().optional(),
  sub_id_2: z.string().optional(),
  ip_click: z.string().optional(),
});

const ok = () => new NextResponse("1", { status: 200, headers: { "content-type": "text/plain" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "content-type": "text/plain" } });

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`cpx:${ip}`, 60, 60_000)) return fail(429);

  if (!isCpxConfigured()) return fail(503);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    console.warn("[cpx] malformed postback", { ip });
    return fail(400);
  }
  const q = parsed.data;
  const p: CpxPostbackParams = {
    status: q.status,
    transId: q.trans_id,
    extUserId: q.user_id,
    amountLocal: q.amount_local,
    amountUsd: q.amount_usd,
    offerId: q.offer_id,
    hash: q.hash,
    subId: q.sub_id,
    subId2: q.sub_id_2,
    ipClick: q.ip_click,
  };

  const shape = validatePostbackShape(p);
  if (!shape.ok) {
    console.warn("[cpx] invalid shape", { error: shape.error, transId: p.transId.slice(0, 32) });
    return fail(400);
  }

  if (!verifyPostbackHash(p.transId, p.hash)) {
    // Record the attempt for admin visibility (no reward, no user trust).
    try {
      const db = getSupabaseAdmin();
      const { data: profile } = await db.from("profiles").select("id").eq("id", p.extUserId).maybeSingle();
      await db.from("provider_events").insert({
        provider: "cpx",
        external_event_id: p.transId,
        user_id: profile?.id ?? null,
        external_offer_id: p.offerId,
        event_type: "invalid_signature",
        publisher_revenue_cents: 0,
        user_reward_cents: 0,
        raw_payload: { status: p.status, trans_id: p.transId, offer_id: p.offerId },
        processing_status: "rejected",
        error: "invalid_hash",
      });
    } catch {
      // Audit insert must never break the fail-closed response.
    }
    console.warn("[cpx] invalid signature", { transId: p.transId.slice(0, 32) });
    return fail(403);
  }

  try {
    const result = await processCpxPostback(new SupabaseCpxStore(), normalizePostback(p));
    console.info("[cpx] postback", { transId: p.transId, status: p.status, outcome: result.outcome });
    switch (result.outcome) {
      case "rewarded":
      case "duplicate":
      case "reversed":
      case "orphan_reversal":
        return ok();
      case "rejected":
        // unknown_user / mismatch: 422 signals a (possibly transient) processing failure.
        return fail(422);
    }
  } catch (err) {
    console.error("[cpx] processing error", { transId: p.transId.slice(0, 32) });
    return fail(500);
  }
}

export async function POST() {
  return fail(405);
}
