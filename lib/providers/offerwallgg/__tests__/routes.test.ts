import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  isAdminEmail: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import { getSessionUser, isAdminEmail, getSupabaseAdmin } from "@/lib/auth/server";
import { GET as wallGET } from "@/app/api/providers/offerwallgg/wall/route";
import { GET as postbackGET, POST as postbackPOST } from "@/app/api/providers/offerwallgg/postback/route";

const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "test-secret-for-offerwallgg";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TX = "e794d89342e0c468f6dd81205999425b";
const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>): Promise<{ data: unknown[] | null; error: unknown }> => ({
  data: [],
  error: null,
}));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const keys = ["OFFERWALLGG_PUBLIC_KEY", "OFFERWALLGG_SECRET_KEY", "OFFERWALLGG_PREVIEW_ENABLED", "OFFERWALLGG_LINK_EXPIRY_ENABLED", "OFFERWALLGG_TEST_POSTBACK_ENABLED", "OFFERWALLGG_POSTBACK_ENABLED", "OFFERWALLGG_REWARD_PROCESSING_ENABLED", "OFFERWALLGG_WALL_ENABLED", "SUPABASE_SERVICE_ROLE_KEY"];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  try {
    for (const k of keys) {
      const v = vars[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await run();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}
const ENV = {
  OFFERWALLGG_PUBLIC_KEY: KEY,
  OFFERWALLGG_SECRET_KEY: SECRET,
  OFFERWALLGG_PREVIEW_ENABLED: "true",
  OFFERWALLGG_TEST_POSTBACK_ENABLED: "true",
};

function signedRequest(amount: string, test: string, status = "credited"): Request {
  const signature = createHmac("sha256", SECRET).update(USER + ":" + TX + ":" + amount, "utf8").digest("hex");
  const q = new URLSearchParams({ userId: USER, transactionId: TX, currencyAmount: amount, signature, test, status });
  return new Request("https://freearn.online/api/providers/offerwallgg/postback?" + q.toString());
}

describe("Offerwall.GG locked down server routes", () => {
  it("requires login and administrator email for preview; never emits paid URL", async () => {
    await withEnv(ENV, async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);
      expect((await wallGET()).status).toBe(401);
      vi.mocked(getSessionUser).mockResolvedValue({ id: USER, email: "other@example.com" });
      vi.mocked(isAdminEmail).mockReturnValue(false);
      expect((await wallGET()).status).toBe(403);
      vi.mocked(getSessionUser).mockResolvedValue({ id: USER, email: "admin@example.com" });
      vi.mocked(isAdminEmail).mockReturnValue(true);
      const response = await wallGET();
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      const data = (await response.json()) as { url: string; previewOnly: boolean };
      expect(data.previewOnly).toBe(true);
      expect(new URL(data.url).searchParams.get("userId")).toBeNull();
      expect(JSON.stringify(data)).not.toContain(SECRET);
    });
  });

  it("keeps even admin preview off if flag is absent", async () => {
    await withEnv({ ...ENV, OFFERWALLGG_PREVIEW_ENABLED: undefined }, async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: USER, email: "admin@example.com" });
      vi.mocked(isAdminEmail).mockReturnValue(true);
      expect((await wallGET()).status).toBe(503);
    });
  });

  it("no key or disabled postback means no acknowledgement", async () => {
    await withEnv({ ...ENV, OFFERWALLGG_TEST_POSTBACK_ENABLED: undefined }, async () => {
      expect((await postbackGET(signedRequest("1750.25", "1"))).status).toBe(503);
    });
    await withEnv({ ...ENV, OFFERWALLGG_SECRET_KEY: undefined }, async () => {
      expect((await postbackGET(signedRequest("1750.25", "1"))).status).toBe(403);
    });
  });

  it("acks only valid signed dashboard tests; never writes money", async () => {
    await withEnv(ENV, async () => {
      const response = await postbackGET(signedRequest("1750.25", "1"));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("1");
      expect((await postbackGET(signedRequest("-1750.25", "1"))).status).toBe(200);
      expect((await postbackGET(signedRequest("1750.25", "0"))).status).toBe(503);
      const forged = new URL(signedRequest("1750.25", "1").url);
      forged.searchParams.set("currencyAmount", "9999");
      expect((await postbackGET(new Request(forged))).status).toBe(403);
    });
  });
});

describe("Offerwall.GG live gates and reconciled money callbacks", () => {
  const LIVE = {
    ...ENV,
    OFFERWALLGG_POSTBACK_ENABLED: "true",
    OFFERWALLGG_REWARD_PROCESSING_ENABLED: "true",
    OFFERWALLGG_WALL_ENABLED: "true",
    SUPABASE_SERVICE_ROLE_KEY: "unit-test-only",
  };

  function providerApi(status: string, units: number, payoutUsd: number, userId = USER) {
    const mocked = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        success: true,
        data: { conversions: [{
          transactionId: TX, userId, status, currencyAmount: units,
          payoutUsd, offerName: "Test offer", offerId: "offer-1",
        }] },
      }),
    }));
    vi.stubGlobal("fetch", mocked);
    return mocked;
  }

  it("all real money gates default OFF: never credits real callbacks", async () => {
    await withEnv(ENV, async () => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  it("enables signed per-user wall only with all financial gates", async () => {
    await withEnv({ ...LIVE, OFFERWALLGG_WALL_ENABLED: undefined }, async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: USER, email: "user@example.com" });
      vi.mocked(isAdminEmail).mockReturnValue(false);
      expect((await wallGET()).status).toBe(403);
    });
    await withEnv(LIVE, async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: USER, email: "user@example.com" });
      const response = await wallGET();
      const data = (await response.json()) as { url: string; previewOnly: boolean };
      expect(response.status).toBe(200);
      expect(data.previewOnly).toBe(false);
      expect(new URL(data.url).searchParams.get("userId")).toBe(USER);
      expect(data.url).not.toContain(SECRET);
    });
  });

  it("credits 60 Cent without multiplying 60% again; checks provider API", async () => {
    await withEnv(LIVE, async () => {
      const api = providerApi("credited", 60, 1);
      rpc.mockResolvedValue({ data: [{ outcome: "credited", ledger_id: "some-id" }], error: null });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      const response = await postbackGET(signedRequest("60", "0"));
      expect(response.status).toBe(200);
      expect(api).toHaveBeenCalledOnce();
      const url = new URL(api.mock.calls[0][0]);
      expect(url.searchParams.get("transactionId")).toBe(TX);
      expect(rpc).toHaveBeenCalledWith("process_offerwallgg_conversion",
        expect.objectContaining({ p_status: "credited", p_units4: "600000", p_publisher_revenue_cents: 100 }));
    });
  });

  it("also accepts historical 70-unit conversions without repricing them", async () => {
    await withEnv(LIVE, async () => {
      providerApi("credited", 70, 1);
      rpc.mockResolvedValue({ data: [{ outcome: "credited", ledger_id: "some-id" }], error: null });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackGET(signedRequest("70", "0"))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("process_offerwallgg_conversion",
        expect.objectContaining({ p_units4: "700000" }));
    });
  });

  it("reversed callbacks debit the exact signed units, with authenticated API status", async () => {
    await withEnv(LIVE, async () => {
      providerApi("reversed", -60, -1);
      rpc.mockResolvedValue({ data: [{ outcome: "reversed", ledger_id: "some-id" }], error: null });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackGET(signedRequest("-60", "0", "reversed"))).status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("process_offerwallgg_conversion",
        expect.objectContaining({ p_status: "reversed", p_units4: "-600000" }));
    });
  });

  it("late original callback after reversal cannot credit: records reversal first", async () => {
    await withEnv(LIVE, async () => {
      providerApi("reversed", -60, -1);
      rpc.mockResolvedValue({ data: [{ outcome: "reversal_pending", ledger_id: null }], error: null });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(200);
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ p_status: "reversed", p_units4: "-600000" }));
      expect(rpc.mock.calls[1][1]).toEqual(expect.objectContaining({ p_status: "credited", p_units4: "600000" }));
    });
  });

  it("rejects forged amount or duplicate money parameters", async () => {
    await withEnv(LIVE, async () => {
      providerApi("credited", 60, 1);
      const fake = new URL(signedRequest("60", "0").url);
      fake.searchParams.set("currencyAmount", "600");
      expect((await postbackGET(new Request(fake))).status).toBe(403);
      const dup = new URL(signedRequest("60", "0").url);
      dup.searchParams.append("currencyAmount", "60");
      expect((await postbackGET(new Request(dup))).status).toBe(400);
    });
  });

  it("does not pay on API mismatch, lag, or DB RPC failure", async () => {
    await withEnv(LIVE, async () => {
      providerApi("credited", 600, 1);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(503);
      providerApi("pending", 60, 1);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(503);
      providerApi("credited", 60, 1);
      rpc.mockResolvedValue({ data: null, error: { message: "database not ready" } });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(503);
    });
  });

  it("fails closed and leaves the RPC untouched when the provider API times out", async () => {
    await withEnv(LIVE, async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackGET(signedRequest("60", "0"))).status).toBe(503);
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  it("supports provider POST form callbacks, tests remain write-free", async () => {
    await withEnv(LIVE, async () => {
      const url = new URL(signedRequest("60", "1").url);
      const request = new Request("https://freearn.online/api/providers/offerwallgg/postback", {
        method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
        body: url.searchParams.toString(),
      });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
      expect((await postbackPOST(request)).status).toBe(200);
      expect(rpc).not.toHaveBeenCalled();
    });
  });
});
