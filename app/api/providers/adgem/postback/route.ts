import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateAdgemBody } from "@/lib/providers/adgem/shared";
import { isAdgemConfigured, verifyAdgemSignature } from "@/lib/providers/adgem/server";
import { processAdgemPostback } from "@/lib/providers/adgem/process";
import { SupabaseAdgemStore } from "@/lib/db/adgem-store";

/**
 * AdGem Server Postback v3 receiver (server-only, POST only).
 *
 * Pipeline: rate limit → configured? → read EXACT RAW body → HMAC-SHA256
 * signature check → JSON parse → shape validation → user lookup →
 * idempotent event store (verified rewards are HELD, never credited —
 * see lib/providers/adgem/process.ts) → acknowledge.
 * FAILS CLOSED at every stage.
 *
 * Acknowledgement mirrors AdGem's own reference behavior: HTTP 200 with an
 * empty body means "received, stop retrying"; 4xx/5xx leave retry semantics
 * to AdGem. No response body is invented.
 */

const empty = (status: number) => new NextResponse(null, { status });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`adgem:${ip}`, 60, 60_000)) return empty(429);

  if (!isAdgemConfigured()) return empty(503);

  // Raw bytes FIRST — never parse/stringify before signature verification.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return empty(400);
  }
  if (!verifyAdgemSignature(rawBody, req.headers.get("signature"))) {
    console.warn("[adgem] invalid signature");
    return empty(401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.warn("[adgem] malformed JSON");
    return empty(400);
  }

  const shape = validateAdgemBody(parsed);
  if (!shape.ok) {
    console.warn("[adgem] invalid shape", { error: shape.error });
    return empty(400);
  }

  try {
    const result = await processAdgemPostback(new SupabaseAdgemStore(), shape.body);
    console.info("[adgem] postback", {
      requestId: shape.body.requestId,
      outcome: result.outcome,
      ...(result.outcome === "rejected" ? { error: result.error } : {}),
    });
    switch (result.outcome) {
      case "held":
      case "recorded":
      case "duplicate":
        return empty(200);
      case "rejected":
        // unsupported_conversion_type is a shape-level refusal;
        // unknown_player / request_id_mismatch may be transient or hostile.
        return empty(result.error === "unsupported_conversion_type" ? 400 : 422);
    }
  } catch {
    console.error("[adgem] processing error");
    return empty(500);
  }
}

export async function GET() {
  return empty(405);
}

export async function PUT() {
  return empty(405);
}

export async function PATCH() {
  return empty(405);
}

export async function DELETE() {
  return empty(405);
}
