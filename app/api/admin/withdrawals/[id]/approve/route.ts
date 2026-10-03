import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { rateLimit } from "@/lib/rate-limit";
import { settleWithdrawal } from "@/lib/db/withdrawals";

/**
 * POST /api/admin/withdrawals/[id]/approve — idempotent manual payout mark.
 * Deny-by-default: non-admins get 404 (never 403), matching middleware.
 * Money moves only inside settle_withdrawal(); repeating approval is a no-op.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!rateLimit(`admin-withdraw:${user!.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  let result;
  try {
    result = await settleWithdrawal(params.id, "paid", user!.email ?? user!.id);
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(
    { requestId: result.requestId, status: result.newStatus, already: result.already },
    { status: 200 }
  );
}
