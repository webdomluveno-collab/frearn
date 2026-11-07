import { NextResponse } from "next/server";
import { verifyOfferwallggCallback } from "@/lib/providers/offerwallgg/server";

/**
 * Offerwall.GG TEST CALLBACK ONLY. No database and NO money writes.
 * Authentic non-test postbacks return 503, so the provider does not receive
 * a false success acknowledgement if a paid wall was accidentally exposed.
 * Never enable public earning on this preview implementation.
 */
const ok = () => new NextResponse("1", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (process.env.OFFERWALLGG_TEST_POSTBACK_ENABLED !== "true") return fail(503);
  const params = new URL(request.url).searchParams;
  const input = {
    userId: params.get("userId") ?? "",
    transactionId: params.get("transactionId") ?? "",
    currencyAmount: params.get("currencyAmount") ?? "",
    signature: params.get("signature") ?? "",
  };
  if (!verifyOfferwallggCallback(input)) return fail(403);
  if (params.get("test") !== "1") return fail(503);
  return ok();
}

export async function POST() {
  // Dashboard must select GET for the test; production processing is not ready.
  return fail(405);
}
