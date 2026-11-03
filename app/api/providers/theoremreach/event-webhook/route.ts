import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  isTheoremreachEventProcessingEnabled,
  isTheoremreachEventWebhookEnabled,
  theoremreachEventWebhookUrlWithoutHash,
  verifyTheoremreachCallbackHash,
} from "@/lib/providers/theoremreach/server";
import { SupabaseTheoremreachStore } from "@/lib/db/theoremreach-store";
import { isEventId, isReasonableId, isUuid } from "@/lib/providers/theoremreach/shared";

/**
 * TheoremReach Event Webhook — reversals and bans.
 *
 * Official contract: POST with `enc_salt` + `hash` query parameters. The hash
 * is HMAC-SHA1 over the full URL up to `&hash=`; the JSON body is not signed.
 * `enc_salt` is the unique event id and is used for idempotency.
 *
 * - Master switch and financial write gate are separate and default OFF.
 * - Every request is HMAC-verified before the database store is constructed.
 * - Reversal amounts are taken from the original reward ledger, never from the
 *   webhook body.
 * - Nothing is logged: payloads contain identity and financial data.
 */

const MAX_BODY_BYTES = 64 * 1024;
const ok = () => new NextResponse("1", { status: 200, headers: { "content-type": "text/plain" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "content-type": "text/plain" } });

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`theoremreach:event-webhook:${ip}`, 60, 60_000)) return fail(429);

  if (!isTheoremreachEventWebhookEnabled()) return fail(503);

  const url = new URL(req.url);
  const eventId = url.searchParams.get("enc_salt");
  const hash = url.searchParams.get("hash");
  if (!isEventId(eventId) || typeof hash !== "string" || hash === "") return fail(400);

  // Canonical origin is siteConfig.url, never Host/X-Forwarded-Host.
  const unsignedUrl = theoremreachEventWebhookUrlWithoutHash(req.url);
  if (!unsignedUrl) return fail(400);
  if (!verifyTheoremreachCallbackHash(unsignedUrl, hash)) return fail(403);

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return fail(400);
  }
  if (Buffer.byteLength(bodyText, "utf8") > MAX_BODY_BYTES) return fail(413);

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return fail(400);
  }
  if (!isObject(body) || !isObject(body.data)) return fail(400);
  const data = body.data;

  if (data.event_type !== "reversal" && data.event_type !== "ban") return fail(400);
  if (!isUuid(data.user_id)) return fail(400);

  const configuredApiKey = process.env.THEOREMREACH_API_KEY?.trim();
  if (configuredApiKey && typeof data.api_key === "string" && data.api_key !== configuredApiKey) {
    return fail(400);
  }

  // Separate write gate: webhook acknowledgement alone never writes.
  if (!isTheoremreachEventProcessingEnabled()) return fail(503);

  try {
    const store = new SupabaseTheoremreachStore();

    if (data.event_type === "ban") {
      // Official ban example uses `ban_reason`; accept `reason` only as a
      // compatibility fallback for older dashboard payloads.
      const rawReason = typeof data.ban_reason === "string" ? data.ban_reason : data.reason;
      const reason = typeof rawReason === "string" ? rawReason.slice(0, 200) : "unspecified";
      const outcome = await store.processBanAtomically({
        eventId,
        userId: data.user_id,
        reason,
        rawPayload: data,
      });
      if (outcome.outcome === "banned" || outcome.outcome === "duplicate") return ok();
      return fail(422);
    }

    const reversed = data.reversed_transactions;
    if (!Array.isArray(reversed) || reversed.length === 0 || reversed.length > 100) return fail(400);

    const transactions: string[] = [];
    for (const item of reversed) {
      if (!isObject(item) || !isReasonableId(item.transaction_id)) return fail(400);
      transactions.push(item.transaction_id);
    }

    for (const txId of transactions) {
      const outcome = await store.processReversalAtomically({
        eventId,
        userId: data.user_id,
        txId,
        rawPayload: { ...data, tx_id: txId },
      });
      if (
        outcome.outcome !== "reversed" &&
        outcome.outcome !== "duplicate" &&
        outcome.outcome !== "orphan_reversal"
      ) {
        return fail(422);
      }
    }
    return ok();
  } catch {
    // Never log signed payloads, identities, or database error details.
    return fail(500);
  }
}

export async function GET() {
  return fail(405);
}
