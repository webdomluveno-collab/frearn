import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/auth/server";
import {
  normalizePostback,
  validatePostbackShape,
  type TimewallPostbackParams,
} from "@/lib/providers/timewall/shared";
import { isTimewallConfigured, verifyTimewallHash } from "@/lib/providers/timewall/server";
import { processTimewallPostback } from "@/lib/providers/timewall/process";
import { SupabaseTimewallStore } from "@/lib/db/timewall-store";

/**
 * TimeWall server-to-server postback (server-only).
 *
 * Pipeline: rate limit → configured? → extract raw query strings → charset
 * validation (guarantees raw == decoded for hashing) → signature check
 * (SHA256(userid + revenue_raw + secret), timing-safe) → shape validation →
 * user lookup → ledger-anchored idempotent processing → acknowledge.
 * FAILS CLOSED: unverified or malformed callbacks never create rewards.
 *
 * Responses mirror the CPX convention ("1" accepted / "0" rejected, plain
 * text). Confirm the exact acknowledgement format with TimeWall after approval.
 */

const querySchema = {
  required: ["userid", "txid", "revenue", "currency", "hash", "type"] as const,
};

const ok = () => new NextResponse("1", { status: 200, headers: { "content-type": "text/plain" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "content-type": "text/plain" } });

export async function GET(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`timewall:${ip}`, 60, 60_000)) return fail(429);

  if (!isTimewallConfigured()) return fail(503);

  // NOTE on IP allowlisting: TimeWall documents three sending IPs, but the
  // deployment runs behind Netlify's proxy and there is no verified,
  // spoof-proof mechanism to recover the true client IP here (a client-supplied
  // X-Forwarded-For prefix cannot be trusted). Enforcing an allowlist on an
  // untrusted header would be security theater — and worse, it could lock out
  // legitimate TimeWall callbacks. Authentication therefore rests SOLELY on
  // the cryptographic hash until Netlify's official client-IP mechanism is
  // verified. See README §12.
  const url = new URL(req.url);
  const get = (name: string): string | null => url.searchParams.get(name);

  for (const name of querySchema.required) {
    const v = get(name);
    if (v === null || v === "") {
      console.warn("[timewall] missing parameter", { param: name });
      return fail(400);
    }
  }

  const p: TimewallPostbackParams = {
    userid: get("userid") as string,
    txid: get("txid") as string,
    revenueRaw: get("revenue") as string,
    currencyRaw: get("currency") as string,
    hash: get("hash") as string,
    type: get("type") as string,
    ip: get("ip") ?? undefined,
    withdrawid: get("withdrawid") ?? undefined,
    reason: get("reason") ?? undefined,
    offername: get("offername") ?? undefined,
    offerdetail: get("offerdetail") ?? undefined,
  };

  // Charset gate BEFORE hashing: UUID/decimal/hex charsets are decoding-invariant,
  // so the parsed values are byte-identical to the raw query strings the hash covers.
  // Anything outside these charsets is rejected without touching the secret path.
  const shape = validatePostbackShape(p);
  if (!shape.ok) {
    console.warn("[timewall] invalid shape", { error: shape.error, txid: p.txid.slice(0, 32) });
    return fail(400);
  }

  if (!verifyTimewallHash(p.userid, p.revenueRaw, p.hash)) {
    // Record the attempt for admin visibility (no reward, no user trust).
    try {
      const db = getSupabaseAdmin();
      const { data: profile } = await db.from("profiles").select("id").eq("id", p.userid).maybeSingle();
      await db.from("provider_events").insert({
        provider: "timewall",
        external_event_id: p.txid,
        user_id: profile?.id ?? null,
        external_offer_id: null,
        event_type: "invalid_signature",
        publisher_revenue_cents: 0,
        user_reward_cents: 0,
        raw_payload: { txid: p.txid, type: p.type },
        processing_status: "rejected",
        error: "invalid_hash",
      });
    } catch {
      // Audit insert must never break the fail-closed response.
    }
    console.warn("[timewall] invalid signature", { txid: p.txid.slice(0, 32) });
    return fail(403);
  }

  try {
    const result = await processTimewallPostback(new SupabaseTimewallStore(), normalizePostback(p));
    console.info("[timewall] postback", { txid: p.txid, type: p.type, outcome: result.outcome });
    switch (result.outcome) {
      case "credited":
      case "duplicate":
      case "held":
        return ok();
      case "rejected":
        // unknown_user / mismatch: 422 signals a (possibly transient) processing failure.
        return fail(422);
    }
  } catch {
    console.error("[timewall] processing error", { txid: p.txid.slice(0, 32) });
    return fail(500);
  }
}

export async function POST() {
  return fail(405);
}
