import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/providers/cpx/postback/route";

const SECRET = "route-test-secret";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function saveEnv() {
  return {
    secure: process.env.CPX_APP_SECURE_HASH,
    postback: process.env.CPX_POSTBACK_SECRET,
    enabled: process.env.CPX_POSTBACK_ENABLED,
    svc: process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

function restoreEnv(prev: { secure?: string; postback?: string; enabled?: string; svc?: string; url?: string }) {
  if (prev.secure === undefined) delete process.env.CPX_APP_SECURE_HASH;
  else process.env.CPX_APP_SECURE_HASH = prev.secure;
  if (prev.postback === undefined) delete process.env.CPX_POSTBACK_SECRET;
  else process.env.CPX_POSTBACK_SECRET = prev.postback;
  if (prev.enabled === undefined) delete process.env.CPX_POSTBACK_ENABLED;
  else process.env.CPX_POSTBACK_ENABLED = prev.enabled;
  if (prev.svc === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = prev.svc;
  if (prev.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = prev.url;
}

function req(query: string): Request {
  return new Request(`https://freearn.local/api/providers/cpx/postback${query}`);
}

const FULL_BAD_HASH =
  "?status=1&trans_id=t-route-1&user_id=" +
  UID +
  "&amount_local=0.35&amount_usd=0.50&offer_id=1&hash=00000000000000000000000000000000&ip_click=1.2.3.4";

describe("POST /api/providers/cpx/postback (HTTP behavior)", () => {
  const prev = saveEnv();
  afterEach(() => restoreEnv(prev));

  it("503 when CPX is not configured (fail closed)", async () => {
    delete process.env.CPX_APP_SECURE_HASH;
    delete process.env.CPX_POSTBACK_SECRET;
    delete process.env.CPX_POSTBACK_ENABLED;
    const res = await GET(req(FULL_BAD_HASH));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("0");
  });

  it("400 on malformed query", async () => {
    process.env.CPX_APP_SECURE_HASH = SECRET;
    process.env.CPX_POSTBACK_ENABLED = "true";
    const res = await GET(req("?status=1&trans_id=x"));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("0");
  });

  it("403 on invalid hash, no reward created", async () => {
    process.env.CPX_APP_SECURE_HASH = SECRET;
    process.env.CPX_POSTBACK_ENABLED = "true";
    const res = await GET(req(FULL_BAD_HASH));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("0");
  });

  it("500 (fail closed) when signature is valid but no database exists", async () => {
    process.env.CPX_APP_SECURE_HASH = SECRET;
    process.env.CPX_POSTBACK_ENABLED = "true";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const transId = "t-route-valid";
    const hash = createHash("md5").update(`${transId}-${SECRET}`, "utf8").digest("hex");
    const res = await GET(
      req(`?status=1&trans_id=${transId}&user_id=${UID}&amount_local=1.40&amount_usd=2.00&offer_id=9&hash=${hash}`)
    );
    // No service-role key → store cannot be constructed → 500, nothing credited.
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("0");
  });

  it("405 on POST", async () => {
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
