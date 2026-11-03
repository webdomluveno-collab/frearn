import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  isTheoremreachPostbackEnabled,
  isTheoremreachRewardProcessingEnabled,
  theoremreachCallbackUrlWithoutHash,
  verifyTheoremreachCallbackHash,
} from "@/lib/providers/theoremreach/server";
import { processTheoremreachCallback } from "@/lib/providers/theoremreach/process";
import { SupabaseTheoremreachStore } from "@/lib/db/theoremreach-store";
import {
  callbackTxId,
  intendedPublisherCents,
  intendedUserCents,
  isDebugTrue,
  isReversalTrue,
  isUuid,
  readCallbackFields,
} from "@/lib/providers/theoremreach/shared";

/**
 * TheoremReach Reward Callback.
 *
 * - Every callback is authenticated before the database store is constructed.
 * - debug=true → 200 "1" with ZERO writes.
 * - Financial processing has a second, default-off server feature flag.
 * - `status` is deprecated and never consulted.
 * - Reversals use the separate Event Webhook, never this callback.
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

  // Use the configured canonical origin and the unmodified request-target
  // query. Never sign an origin derived from Host/X-Forwarded-Host.
  const unsignedCallbackUrl = theoremreachCallbackUrlWithoutHash(req.url);
  if (!unsignedCallbackUrl) return fail(400);

  // Shape validation before any trust decision. Required: reward, currency,
  // user_id (UUID), hash, and the official transaction_id (tx_id is a legacy
  // alias only).
  if (typeof f.rewardRaw !== "string" || f.rewardRaw === "") return fail(400);
  if (typeof f.currencyRaw !== "string" || f.currencyRaw === "") return fail(400);
  if (!isUuid(f.userId)) return fail(400);
  if (typeof f.hash !== "string" || f.hash === "") return fail(400);
  if (callbackTxId(f) === null) return fail(400);

  if (f.reversalRaw !== null && f.reversalRaw !== "true" && f.reversalRaw !== "false") return fail(400);

  // Signature covers the exact canonical URL before any DB client/store exists.
  if (!verifyTheoremreachCallbackHash(unsignedCallbackUrl, f.hash)) return fail(403);

  const reversal = isReversalTrue(f.reversalRaw);
  const userRewardCents = intendedUserCents(f.rewardRaw);
  const publisherRevenueCents = intendedPublisherCents(f.currencyRaw);
  if (userRewardCents === null || publisherRevenueCents === null) return fail(400);

  // This separate gate defaults off, even if callback signature verification
  // is enabled for a non-money test. Keep it off until the activation criteria
  // in README §11b are approved.
  if (!isTheoremreachRewardProcessingEnabled()) return fail(403);

  try {
    const outcome = await processTheoremreachCallback(new SupabaseTheoremreachStore(), {
      txId: callbackTxId(f)!,
      userId: f.userId,
      reversal,
      userRewardCents,
      publisherRevenueCents,
    });
    switch (outcome.outcome) {
      case "rewarded":
      case "duplicate":
      case "reversal_pending":
        return ok();
      case "reversal_disabled":
        return fail(422);
      case "rejected":
        return fail(422);
    }
  } catch {
    // Avoid logging signed callback contents or database error details.
    return fail(500);
  }
}

export async function POST() {
  return fail(405);
}
