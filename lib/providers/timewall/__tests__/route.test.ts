import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/providers/timewall/postback/route";

const KEY = "test-timewall-secret-route";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function saveEnv() {
  return {
    secret: process.env.TIMEWALL_POSTBACK_SECRET,
    enabled: process.env.TIMEWALL_POSTBACK_ENABLED,
    svc: process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

type Env = ReturnType<typeof saveEnv>;

function restoreEnv(prev: Env) {
  for (const [envKey, prop] of [
    ["TIMEWALL_POSTBACK_SECRET", "secret"],
    ["TIMEWALL_POSTBACK_ENABLED", "enabled"],
    ["SUPABASE_SERVICE_ROLE_KEY", "svc"],
    ["NEXT_PUBLIC_SUPABASE_URL", "url"],
  ] as const) {
    if (prev[prop] === undefined) delete process.env[envKey];
    else process.env[envKey] = prev[prop] as string;
  }
}

function enable() {
  process.env.TIMEWALL_POSTBACK_SECRET = KEY;
  process.env.TIMEWALL_POSTBACK_ENABLED = "true";
  // No database in unit tests: valid-shape requests must fail closed (500),
  // never credit. Proves no code path reaches money without a real store.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function signedQuery(overrides: Record<string, string> = {}, secret = KEY): string {
  const q: Record<string, string> = {
    userid: UID,
    txid: "tw-route-1",
    revenue: "1.00",
    currency: "70",
    type: "test_earn",
    ...overrides,
  };
  const hash = createHash("sha256").update(`${q.userid}${q.revenue}${secret}`, "utf8").digest("hex");
  const params = new URLSearchParams({ ...q, hash });
  return `https://freearn.local/api/providers/timewall/postback?${params.toString()}`;
}

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("GET /api/providers/timewall/postback (HTTP behavior)", () => {
  const prev = saveEnv();
  const restore = () => restoreEnv(prev);

  it("503 when TimeWall is not configured (fail closed)", async () => {
    delete process.env.TIMEWALL_POSTBACK_SECRET;
    delete process.env.TIMEWALL_POSTBACK_ENABLED;
    try {
      const res = await GET(get(signedQuery()));
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("400 on missing parameters", async () => {
    enable();
    try {
      const res = await GET(get("https://freearn.local/api/providers/timewall/postback?userid=abc"));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("400 on malformed values", async () => {
    enable();
    try {
      const res = await GET(get(signedQuery({ revenue: "abc", currency: "70" })));
      expect(res.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("403 on invalid hash", async () => {
    enable();
    try {
      const url = signedQuery().replace(/hash=[0-9a-f]+/, `hash=${"0".repeat(64)}`);
      const res = await GET(get(url));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("500 (fail closed, retryable) when signature is valid but no database exists", async () => {
    enable();
    try {
      const res = await GET(get(signedQuery()));
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("405 on POST", async () => {
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
