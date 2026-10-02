import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/providers/theoremreach/postback/route";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const KEY = "test-theoremreach-secret-postback";

function saveEnv() {
  return {
    secret: process.env.THEOREMREACH_SECRET_KEY,
    enabled: process.env.THEOREMREACH_POSTBACK_ENABLED,
  };
}

function restoreEnv(prev: { secret: string | undefined; enabled: string | undefined }) {
  if (prev.secret === undefined) delete process.env.THEOREMREACH_SECRET_KEY;
  else process.env.THEOREMREACH_SECRET_KEY = prev.secret;
  if (prev.enabled === undefined) delete process.env.THEOREMREACH_POSTBACK_ENABLED;
  else process.env.THEOREMREACH_POSTBACK_ENABLED = prev.enabled;
}

function enable() {
  process.env.THEOREMREACH_SECRET_KEY = KEY;
  process.env.THEOREMREACH_POSTBACK_ENABLED = "true";
}

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

function cb(params: Record<string, string>): string {
  return `https://freearn.local/api/providers/theoremreach/postback?${new URLSearchParams(params).toString()}`;
}

function live(extra: Record<string, string> = {}): string {
  return cb({
    reward: "70",
    currency: "1.00",
    user_id: UID,
    tx_id: "tr-live-1",
    hash: "unproven-hash",
    ...extra,
  });
}

describe("GET /api/providers/theoremreach/postback — Phase 1 (no money moves)", () => {
  const prev = saveEnv();
  const restore = () => restoreEnv(prev);

  it("503 when postbacks are not enabled (fail closed)", async () => {
    delete process.env.THEOREMREACH_SECRET_KEY;
    delete process.env.THEOREMREACH_POSTBACK_ENABLED;
    try {
      const res = await GET(get(live()));
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("debug=true returns 200 even with otherwise garbage params (completely ignored)", async () => {
    enable();
    try {
      const res = await GET(get(cb({ debug: "true", nonsense: "<script>" })));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
    } finally {
      restore();
    }
  });

  it("debug=true wins over reversal=true (never reverses, never writes)", async () => {
    enable();
    try {
      const res = await GET(
        get(live({ debug: "true", reversal: "true", reward: "70", currency: "1.00" }))
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
    } finally {
      restore();
    }
  });

  it("valid-shape non-debug callback fails closed (signature unproven — never 200)", async () => {
    enable();
    try {
      const res = await GET(get(live()));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("non-debug reversal=true cannot debit (fails closed)", async () => {
    enable();
    try {
      const res = await GET(get(live({ tx_id: "tr-rev-1", reversal: "true" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("400 on missing/invalid required fields", async () => {
    enable();
    try {
      const cases: Record<string, string>[] = [
        { currency: "1.00", user_id: UID, tx_id: "t", hash: "h" }, // no reward
        { reward: "70", user_id: UID, tx_id: "t", hash: "h" }, // no currency
        { reward: "70", currency: "1.00", tx_id: "t", hash: "h" }, // no user
        { reward: "70", currency: "1.00", user_id: "not-a-uuid", tx_id: "t", hash: "h" },
        { reward: "70", currency: "1.00", user_id: UID, hash: "h" }, // no tx identity
        { reward: "70", currency: "1.00", user_id: UID, tx_id: "t" }, // no hash
      ];
      for (const params of cases) {
        const res = await GET(get(cb(params)));
        expect(res.status).toBe(400);
        expect(await res.text()).toBe("0");
      }
    } finally {
      restore();
    }
  });

  it("400 on non-creditable value shapes (never reaches money)", async () => {
    enable();
    try {
      for (const params of [
        { reward: "70.5", currency: "1.00" },
        { reward: "-5", currency: "1.00" },
        { reward: "abc", currency: "1.00" },
        { reward: "70", currency: "xyz" },
      ]) {
        const res = await GET(get(live({ tx_id: `t-${params.reward}`, ...params })));
        expect(res.status).toBe(400);
      }
    } finally {
      restore();
    }
  });

  it("deprecated status field never controls the outcome", async () => {
    enable();
    try {
      const res = await GET(get(live({ tx_id: "tr-status-1", status: "complete" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("POST is rejected", async () => {
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
