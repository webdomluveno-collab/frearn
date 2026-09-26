import { NextResponse } from "next/server";

/**
 * Future BitLabs callback endpoint (server-only).
 * Structured for: signature validation → normalization → idempotency →
 * user lookup → ledger insert → logging. Fails closed when unconfigured.
 *
 * NEVER trust user-provided reward amounts; rewards come only from
 * validated provider events. Idempotency via unique external event id.
 */
export async function POST(req: Request) {
  const { rateLimit } = await import("@/lib/rate-limit");
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`bitlabs:${ip}`, 60)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (
    !process.env.BITLABS_APP_TOKEN ||
    !process.env.BITLABS_SECRET ||
    process.env.BITLABS_CALLBACK_ENABLED !== "true"
  ) {
    // Do not fake verification without credentials/spec.
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  }

  // TODO(provider): verify signature per BitLabs spec, parse body,
  // normalize to NormalizedCallback, then:
  //  1. insert into provider_events (unique provider+externalEventId) — skip if exists
  //  2. lookup user, create ledger_transactions row (pending→confirmed per rules)
  //  3. update provider_events.processedAt, log outcome
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
