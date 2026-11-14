import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isOfferwallApiPostbackEnabled, verifyOfferwallApiSignature } from "@/lib/providers/offerwallapi/server";

const ok = () => new NextResponse("ok", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
const fail = (status: number) => new NextResponse("0", { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

function mergedParams(request: Request, body: string): URLSearchParams | null {
  const query = new URL(request.url).searchParams;
  const form = new URLSearchParams(body);
  const result = new URLSearchParams();
  const names = new Set([...query.keys(), ...form.keys()]);
  for (const name of names) {
    const values = [...query.getAll(name), ...form.getAll(name)];
    if (values.length !== 1) return null;
    result.set(name, values[0]);
  }
  return result;
}

export async function GET() {
  // Safe registration healthcheck; never acknowledges a live conversion.
  return NextResponse.json({ provider: "offerwallapi", status: "disabled", financialProcessing: false }, { status: 200 });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`offerwallapi:${ip}`, 60, 60_000)) return fail(429);
  if (!isOfferwallApiPostbackEnabled()) return fail(503);
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (type && !type.startsWith("application/x-www-form-urlencoded")) return fail(415);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) return fail(413);
  const body = await request.text();
  if (body.length > 16_384) return fail(413);
  const params = mergedParams(request, body);
  if (!params) return fail(400);

  const subId = params.get("subId") ?? "";
  const transId = params.get("transId") ?? "";
  const reward = params.get("reward") ?? "";
  const signature = params.get("signature2") ?? "";
  const debug = params.get("debug") ?? "0";
  if (["subId", "transId", "reward", "signature2", "debug"].some((name) => params.getAll(name).length !== 1)) return fail(400);
  if (debug !== "0" && debug !== "1") return fail(400);
  if (!verifyOfferwallApiSignature({ subId, transId, reward, signature })) return fail(403);

  // Debug is safe to acknowledge after authentication and never writes money.
  if (debug === "1") return ok();

  // status=1/2 and transId idempotency are intentionally not wired to money
  // yet. A future reviewed implementation must persist provider_events first,
  // then call an atomic RPC; this route must not acknowledge live conversions.
  return fail(503);
}
