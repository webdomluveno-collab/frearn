import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isTheoremreachPostbackEnabled } from "@/lib/providers/theoremreach/server";
import {
  callbackTxId,
  intendedPublisherCents,
  intendedUserCents,
  isDebugTrue,
  isUuid,
  readCallbackFields,
} from "@/lib/providers/theoremreach/shared";

/**
 * TheoremReach postback — PHASE 1 (testing only).
 *
 * - debug=true → 200 "1" with ZERO writes (no ledger, no provider event,
 *   no reversal, no fraud flag, no profile mutation).
 * - Every non-debug callback FAILS CLOSED (403 "0"): the callback signature
 *   payload is unproven, so nothing may be treated as verified. No credit,
 *   no debit, no persistence — an unverified payload must never land in
 *   money/audit structures where it could be mistaken for verified later.
 * - `status` is deprecated and never consulted.
 * - Nothing is logged: callback values may contain identity and amounts.
 */

const ok = () => new NextResponse("1", { status: 200, headers: { "content-type": "text/plain" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "content-type": "text/plain" } });

export async function GET(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`theoremreach:${ip}`, 60, 60_000)) return fail(429);

  if (!isTheoremreachPostbackEnabled()) return fail(503);

  const url = new URL(req.url);
  const get = (name: string): string | null => url.searchParams.get(name);
  const f = readCallbackFields(get);

  // Debug callbacks are completely ignored: acknowledge (so TheoremReach
  // stops retrying test traffic) but write absolutely nothing.
  if (isDebugTrue(f.debugRaw)) return ok();

  // Shape validation before any trust decision. Required: reward, currency,
  // user_id (UUID), hash, plus tx_id or transaction_id (identity unresolved).
  if (typeof f.rewardRaw !== "string" || f.rewardRaw === "") return fail(400);
  if (typeof f.currencyRaw !== "string" || f.currencyRaw === "") return fail(400);
  if (!isUuid(f.userId)) return fail(400);
  if (typeof f.hash !== "string" || f.hash === "") return fail(400);
  if (callbackTxId(f) === null) return fail(400);

  // Value shapes use the documented mapping helpers for VALIDATION ONLY.
  // These helpers can never write money — there is no credit path in Phase 1.
  const reward = Number(f.rewardRaw);
  const currency = Number(f.currencyRaw);
  if (intendedUserCents(reward) === null) return fail(400);
  if (intendedPublisherCents(currency) === null) return fail(400);

  // Signature UNPROVEN → fail closed. Never credit, never persist.
  return fail(403);
}

export async function POST() {
  return fail(405);
}
