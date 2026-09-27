import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/providers/adgem/postback/route";

const KEY = "test-adgem-key-route";
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function saveEnv() {
  return {
    key: process.env.ADGEM_POSTBACK_KEY,
    enabled: process.env.ADGEM_POSTBACK_ENABLED,
    svc: process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
}

type Env = ReturnType<typeof saveEnv>;

function restoreEnv(prev: Env) {
  for (const [envKey, prop] of [
    ["ADGEM_POSTBACK_KEY", "key"],
    ["ADGEM_POSTBACK_ENABLED", "enabled"],
    ["SUPABASE_SERVICE_ROLE_KEY", "svc"],
    ["NEXT_PUBLIC_SUPABASE_URL", "url"],
  ] as const) {
    if (prev[prop] === undefined) delete process.env[envKey];
    else process.env[envKey] = prev[prop] as string;
  }
}

function enable() {
  process.env.ADGEM_POSTBACK_KEY = KEY;
  process.env.ADGEM_POSTBACK_ENABLED = "true";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function sign(raw: string): string {
  return createHmac("sha256", KEY).update(Buffer.from(raw, "utf8")).digest("hex");
}

function post(raw: string | null, signature: string | null): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("signature", signature);
  return new Request("https://freearn.local/api/providers/adgem/postback", {
    method: "POST",
    headers,
    body: raw,
  });
}

function validRaw(requestId = "req-route-1", conversionId = "conv-route-1"): string {
  return JSON.stringify({
    request_id: requestId,
    timestamp: 1748365518,
    data: {
      conversion_id: conversionId,
      player_id: UID,
      conversion_type: "reward",
      amount: 500,
      payout_cents: 150,
      offer_id: 9087,
      goal_id: 4521,
    },
  });
}

describe("POST /api/providers/adgem/postback (HTTP behavior)", () => {
  const prev = saveEnv();
  const restore = () => restoreEnv(prev);

  it("503 when AdGem is not configured (fail closed)", async () => {
    delete process.env.ADGEM_POSTBACK_KEY;
    delete process.env.ADGEM_POSTBACK_ENABLED;
    try {
      const res = await POST(post(validRaw(), sign(validRaw())));
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("");
    } finally {
      restore();
    }
  });

  it("401 on missing signature", async () => {
    enable();
    try {
      const res = await POST(post(validRaw(), null));
      expect(res.status).toBe(401);
    } finally {
      restore();
    }
  });

  it("401 on wrong signature", async () => {
    enable();
    try {
      const res = await POST(post(validRaw(), "0".repeat(64)));
      expect(res.status).toBe(401);
    } finally {
      restore();
    }
  });

  it("401 when body was modified after signing", async () => {
    enable();
    try {
      const raw = validRaw();
      const tampered = raw.replace("500", "501");
      const res = await POST(post(tampered, sign(raw)));
      expect(res.status).toBe(401);
    } finally {
      restore();
    }
  });

  it("401 on malformed JSON with invalid signature (signature is checked before parsing)", async () => {
    enable();
    try {
      const res = await POST(post("{not json", "0".repeat(64)));
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
    } finally {
      restore();
    }
  });

  it("400 on malformed JSON even with a matching signature", async () => {
    enable();
    try {
      const raw = "{not json";
      const res = await POST(post(raw, sign(raw)));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("");
    } finally {
      restore();
    }
  });

  it("400 on non-integer / negative / oversize amounts with valid signature", async () => {
    enable();
    try {
      const base = {
        request_id: "req-amt",
        timestamp: 1748365518,
        data: {
          conversion_id: "conv-amt",
          player_id: UID,
          conversion_type: "reward",
          payout_cents: 150,
        },
      };
      // Zero passes shape but is refused at credit time (see process tests);
      // without a database every valid-shape request ends in 500 here.
      for (const amount of [1.5, -3, 1_000_001]) {
        const raw = JSON.stringify({ ...base, data: { ...base.data, amount } });
        const res = await POST(post(raw, sign(raw)));
        expect(res.status).toBe(400);
      }
    } finally {
      restore();
    }
  });

  it("500 (fail closed, retryable) when signature is valid but no database exists", async () => {
    enable();
    try {
      const raw = validRaw();
      const res = await POST(post(raw, sign(raw)));
      // getSupabaseAdmin() throws without a service key → 500, nothing stored.
      expect(res.status).toBe(500);
      expect(await res.text()).toBe("");
    } finally {
      restore();
    }
  });

  it("405 on non-POST methods with empty body", async () => {
    for (const fn of [GET, PUT, PATCH, DELETE]) {
      const res = await fn();
      expect(res.status).toBe(405);
      expect(await res.text()).toBe("");
    }
  });
});
