import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSupabaseAdmin: vi.fn() }));
import { getSupabaseAdmin } from "@/lib/auth/server";
import { POST } from "@/app/api/providers/admantum/postback/route";
import { admantumCallbackHash } from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SECRET = "admantum-test-secret";
const TOKEN = "admantum-callback-token";
const TX = "admantum-tx-1";
const rpc = vi.fn(async () => ({ data: [{ outcome: "pending_manual_review" }], error: null }));

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [{ outcome: "pending_manual_review" }], error: null });
});

function env(run: () => Promise<void>) {
  const previous = { id: process.env.ADMANTUM_APP_ID, secret: process.env.ADMANTUM_SECRET_KEY, token: process.env.ADMANTUM_CALLBACK_TOKEN, postback: process.env.ADMANTUM_POSTBACK_ENABLED, reward: process.env.ADMANTUM_REWARD_PROCESSING_ENABLED };
  process.env.ADMANTUM_APP_ID = "987654";
  process.env.ADMANTUM_SECRET_KEY = SECRET;
  process.env.ADMANTUM_CALLBACK_TOKEN = TOKEN;
  process.env.ADMANTUM_POSTBACK_ENABLED = "true";
  process.env.ADMANTUM_REWARD_PROCESSING_ENABLED = "true";
  return run().finally(() => {
    for (const [key, value] of [["ADMANTUM_APP_ID", previous.id], ["ADMANTUM_SECRET_KEY", previous.secret], ["ADMANTUM_CALLBACK_TOKEN", previous.token], ["ADMANTUM_POSTBACK_ENABLED", previous.postback], ["ADMANTUM_REWARD_PROCESSING_ENABLED", previous.reward]] as const) value === undefined ? delete process.env[key] : (process.env[key] = value);
  });
}

function request(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { uid: UID, virtual_currency: "60", transaction_id: TX, status: "1", of_id: "offer-1", token: TOKEN, ...overrides };
  if (!overrides.hash) values.hash = admantumCallbackHash(values.uid, values.of_id, values.virtual_currency);
  return new Request("https://freearn.online/api/postbacks/admantum", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values),
  });
}

describe("AdMantum postback safety", () => {
  it("places a verified callback into manual review without financial crediting", async () => {
    await env(async () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as never);
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("record_admantum_pending", expect.objectContaining({ p_virtual_currency: "60", p_status: "credited" }));
    });
  });

  it("acknowledges a repeated callback without creating another review record", async () => {
    await env(async () => {
      rpc.mockResolvedValueOnce({ data: [{ outcome: "pending_manual_review" }], error: null });
      rpc.mockResolvedValueOnce({ data: [{ outcome: "duplicate" }], error: null });
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as never);
      expect((await POST(request())).status).toBe(200);
      expect((await POST(request())).status).toBe(200);
      expect(rpc).toHaveBeenCalledTimes(2);
    });
  });

  it("rejects forged callbacks and never calls the RPC", async () => {
    await env(async () => {
      rpc.mockClear();
      const response = await POST(request({ virtual_currency: "61", hash: "0".repeat(32) }));
      expect(response.status).toBe(403);
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  it("acknowledges reversal after storing it for manual review", async () => {
    await env(async () => {
      rpc.mockClear();
      const response = await POST(request({ status: "0", transaction_id: "new-reversal-id" }));
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("record_admantum_pending", expect.objectContaining({ p_status: "reversed" }));
    });
  });
});
