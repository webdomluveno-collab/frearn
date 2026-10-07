import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser, isSupabaseConfigured } from "@/lib/auth/server";
import { rateLimit } from "@/lib/rate-limit";
import { requestWithdrawal } from "@/lib/db/withdrawals";
import {
  getWithdrawalMinimumCents,
  isActiveWithdrawalMethod,
  isValidDestination,
  isWithdrawableAmount,
  normalizeDestination,
} from "@/lib/withdrawals";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * POST /api/withdrawals/request — manual withdrawal request (user-owned).
 * Auth required; identity comes ONLY from the server session. Funds are
 * reserved atomically inside the request_withdrawal() RPC — the route never
 * checks-then-inserts. Destinations are validated but never logged.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!rateLimit(`withdraw:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const { amountCents, method, destination, requestKey } = b;

  if (!isActiveWithdrawalMethod(method)) {
    return NextResponse.json({ error: "invalid_method" }, { status: 400 });
  }
  if (!isWithdrawableAmount(method, amountCents)) {
    const below = typeof amountCents === "number" && Number.isSafeInteger(amountCents)
      && amountCents > 0 && amountCents < getWithdrawalMinimumCents(method);
    return NextResponse.json(below
      ? { error: "below_minimum", method, minimumCents: getWithdrawalMinimumCents(method) }
      : { error: "invalid_amount" }, { status: 400 });
  }
  if (typeof destination !== "string" || !isValidDestination(method, destination)) {
    return NextResponse.json({ error: "invalid_destination" }, { status: 400 });
  }
  const key = typeof requestKey === "string" && isUuid(requestKey) ? requestKey : randomUUID();

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  let result;
  try {
    result = await requestWithdrawal({
      userId: user.id,
      amountCents,
      method,
      destination: normalizeDestination(method, destination),
      idempotencyKey: key,
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  if (!result.ok) {
    // insufficient_balance -> 422 (well-formed but not fundable); rest -> 400/503.
    if (result.error === "pending_withdrawal") {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    if (result.error === "insufficient_balance") {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    if (result.error === "unavailable") {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Never echo the full destination: the client already knows what it typed;
  // history views re-mask from the stored row. Service-role fields excluded.
  const r = result.request;
  return NextResponse.json(
    {
      request: {
        id: r.id,
        amountCents: r.amountCents,
        method: r.method,
        status: r.status,
        createdAt: r.createdAt,
      },
      duplicate: result.duplicate,
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
