import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/auth/server";
import { isReasonableId } from "@/lib/providers/theoremreach/shared";
import { parseAdmantumVirtualCurrency } from "@/lib/providers/admantum/amounts";
import { isAdmantumPostbackEnabled, verifyAdmantumCallback, verifyAdmantumCallbackToken } from "@/lib/providers/admantum/server";

const fail = (status: number) => new NextResponse("0", { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
const ok = () => new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isAdmantumPostbackEnabled()) return fail(503);
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  const urlParams = new URL(request.url).searchParams;
  if (type && !type.startsWith("application/x-www-form-urlencoded")) return fail(415);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) return fail(413);
  const body = await request.text();
  if (body.length > 16_384) return fail(413);
  const bodyParams = new URLSearchParams(body);
  const params = new URLSearchParams();
  const names = new Set([...urlParams.keys(), ...bodyParams.keys()]);
  for (const name of names) {
    const values = [...urlParams.getAll(name), ...bodyParams.getAll(name)];
    if (values.length !== 1) return fail(400);
    params.set(name, values[0]);
  }
  const userId = params.get("uid") ?? "";
  const virtualCurrency = params.get("virtual_currency") ?? "";
  const transactionId = params.get("transaction_id") ?? "";
  const offerId = params.get("of_id") ?? "";
  const status = params.get("status") ?? "";
  const hash = params.get("hash") ?? "";
  const token = params.get("token") ?? "";
  if (["uid", "virtual_currency", "transaction_id", "status", "hash", "token"].some((name) => params.getAll(name).length !== 1)) return fail(400);
  if (!isReasonableId(transactionId) || (offerId !== "" && !isReasonableId(offerId))) return fail(400);
  if (status !== "1" && status !== "0") return fail(400);
  const payout = params.get("payout");
  if (payout !== null && !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(payout)) return fail(400);
  if (!verifyAdmantumCallbackToken(token)) return fail(403);
  if (!verifyAdmantumCallback({ userId, offerId, virtualCurrency, transactionId, hash })) return fail(403);

  // Never persist the shared callback token or signature in audit payloads.
  const auditParams = new URLSearchParams(params);
  auditParams.delete("token");
  auditParams.delete("hash");

  const units = parseAdmantumVirtualCurrency(virtualCurrency);
  if (units === null) return fail(400);
  try {
    const { data, error } = await getSupabaseAdmin().rpc("record_admantum_pending", {
      p_user_id: userId,
      p_tx_id: transactionId,
      p_status: status === "1" ? "credited" : "reversed",
      p_virtual_currency: units.toString(),
      p_offer_id: offerId,
      p_raw_payload: Object.fromEntries(auditParams.entries()),
    });
    if (error || !Array.isArray(data) || data.length !== 1) return fail(503);
    const outcome = (data[0] as { outcome?: unknown }).outcome;
    return outcome === "pending_manual_review" || outcome === "duplicate" ? ok() : fail(503);
  } catch {
    return fail(503);
  }
}

export async function GET() { return fail(405); }
