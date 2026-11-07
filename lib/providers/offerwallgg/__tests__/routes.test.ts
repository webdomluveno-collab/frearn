import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  isAdminEmail: vi.fn(),
}));

import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { GET as wallGET } from "@/app/api/providers/offerwallgg/wall/route";
import { GET as postbackGET } from "@/app/api/providers/offerwallgg/postback/route";

const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "test-secret-for-offerwallgg";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TX = "e794d89342e0c468f6dd81205999425b";

async function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const keys = ["OFFERWALLGG_PUBLIC_KEY", "OFFERWALLGG_SECRET_KEY", "OFFERWALLGG_PREVIEW_ENABLED", "OFFERWALLGG_LINK_EXPIRY_ENABLED", "OFFERWALLGG_TEST_POSTBACK_ENABLED"];
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

function signedRequest(amount: string, test: string): Request {
  const signature = createHmac("sha256", SECRET).update(USER + ":" + TX + ":" + amount, "utf8").digest("hex");
  const q = new URLSearchParams({ userId: USER, transactionId: TX, currencyAmount: amount, signature, test, status: "credited" });
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
