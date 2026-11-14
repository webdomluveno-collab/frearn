import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/offerwallapi/postback/route";
import { offerwallApiSignature } from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SECRET = "offerwallapi-test-secret";

function withSecret(run: () => Promise<void>) {
  const previous = process.env.OFFERWALLAPI_SECRET_KEY;
  process.env.OFFERWALLAPI_SECRET_KEY = SECRET;
  return run().finally(() => previous === undefined ? delete process.env.OFFERWALLAPI_SECRET_KEY : (process.env.OFFERWALLAPI_SECRET_KEY = previous));
}

function request(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { subId: UID, transId: "tx-1", reward: "60", debug: "0", ...overrides };
  if (!values.signature2) values.signature2 = offerwallApiSignature(values.subId, values.transId, values.reward);
  return new Request("https://freearn.online/api/offerwallapi/postback", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
}

describe("OfferwallApi safe callback foundation", () => {
  it("GET is a safe registration healthcheck", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provider: "offerwallapi", financialProcessing: false });
  });

  it("rejects live POST when the secret is missing", async () => {
    const previous = process.env.OFFERWALLAPI_SECRET_KEY;
    delete process.env.OFFERWALLAPI_SECRET_KEY;
    try {
      const requestWithoutSecret = new Request("https://freearn.online/api/offerwallapi/postback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subId: UID, transId: "tx-1", reward: "60", debug: "0", signature2: "0".repeat(64) }),
      });
      expect((await POST(requestWithoutSecret)).status).toBe(503);
    } finally {
      if (previous !== undefined) process.env.OFFERWALLAPI_SECRET_KEY = previous;
    }
  });

  it("authenticates debug traffic but never acknowledges live money callbacks", async () => {
    await withSecret(async () => {
      expect((await POST(request({ debug: "1" }))).status).toBe(200);
      expect((await POST(request({ debug: "0" }))).status).toBe(503);
    });
  });

  it("rejects forged, altered-identity, duplicate-parameter and unsupported requests", async () => {
    await withSecret(async () => {
      expect((await POST(request({ signature2: "0".repeat(64), debug: "1" }))).status).toBe(403);
      const originalHash = offerwallApiSignature(UID, "tx-1", "60");
      expect((await POST(request({ subId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff", signature2: originalHash, debug: "1" }))).status).toBe(403);
      const duplicate = new Request("https://freearn.online/api/offerwallapi/postback?subId=" + UID + "&subId=" + UID, { method: "POST" });
      expect((await POST(duplicate)).status).toBe(400);
      expect((await GET()).status).toBe(200);
    });
  });
});
