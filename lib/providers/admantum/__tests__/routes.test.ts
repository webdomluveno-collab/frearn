import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSupabaseAdmin: vi.fn() }));
import { getSupabaseAdmin } from "@/lib/auth/server";
import { POST } from "@/app/api/providers/admantum/postback/route";
import { admantumCallbackHash } from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SECRET = "admantum-test-secret";
const TX = "admantum-tx-1";
const rpc = vi.fn(async () => ({ data: [{ outcome: "credited", ledger_id: "ledger-1" }], error: null }));

function env(run: () => Promise<void>) {
  const previous = { id: process.env.ADMANTUM_PUBLISHER_ID, secret: process.env.ADMANTUM_SECRET_KEY, postback: process.env.ADMANTUM_POSTBACK_ENABLED, reward: process.env.ADMANTUM_REWARD_PROCESSING_ENABLED };
  process.env.ADMANTUM_PUBLISHER_ID = "451398";
  process.env.ADMANTUM_SECRET_KEY = SECRET;
  process.env.ADMANTUM_POSTBACK_ENABLED = "true";
  process.env.ADMANTUM_REWARD_PROCESSING_ENABLED = "true";
  return run().finally(() => {
    for (const [key, value] of [["ADMANTUM_PUBLISHER_ID", previous.id], ["ADMANTUM_SECRET_KEY", previous.secret], ["ADMANTUM_POSTBACK_ENABLED", previous.postback], ["ADMANTUM_REWARD_PROCESSING_ENABLED", previous.reward]] as const) value === undefined ? delete process.env[key] : (process.env[key] = value);
  });
}

function request(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { uid: UID, virtual_currency: "60", transaction_id: TX, status: "1", of_id: "offer-1", ...overrides };
  if (!overrides.hash) values.hash = admantumCallbackHash(values.uid, values.of_id, values.virtual_currency);
  return new Request("https://freearn.online/api/postbacks/admantum", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values),
  });
}

describe("AdMantum postback safety", () => {
  it("credits 60 virtual units as 60 user cents and never multiplies by 60%", async () => {
    await env(async () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc } as never);
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("process_admantum_credit", expect.objectContaining({ p_virtual_currency: "60", p_reward_cents: "60", p_publisher_revenue_cents: 100 }));
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

  it("fails closed on reversal because AdMantum supplies no original transaction binding", async () => {
    await env(async () => {
      rpc.mockClear();
      const response = await POST(request({ status: "0", transaction_id: "new-reversal-id" }));
      expect(response.status).toBe(503);
      expect(rpc).not.toHaveBeenCalled();
    });
  });
});
