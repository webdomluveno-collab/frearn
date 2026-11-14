import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));
import { getSessionUser } from "@/lib/auth/server";
import { GET } from "@/app/api/providers/admantum/wall/route";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const keys = Object.keys(vars);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(vars)) value === undefined ? delete process.env[key] : (process.env[key] = value);
    return run().finally(() => {
      for (const key of keys) previous[key] === undefined ? delete process.env[key] : (process.env[key] = previous[key] as string);
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

describe("AdMantum wall route", () => {
  it("requires authentication and the explicit feature flag", async () => {
    await withEnv({ ADMANTUM_APP_ID: "987654", ADMANTUM_ENABLED: undefined }, async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);
      expect((await GET()).status).toBe(401);
      vi.mocked(getSessionUser).mockResolvedValue({ id: UID, email: "user@example.com" });
      expect((await GET()).status).toBe(503);
    });
  });
});
