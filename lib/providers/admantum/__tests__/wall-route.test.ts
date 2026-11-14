import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn(), isAdminEmail: vi.fn() }));
import { getSessionUser } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/server";
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

  it("allows an admin test preview without enabling live rewards", async () => {
    await withEnv({ ADMANTUM_APP_ID: "53190", ADMANTUM_ADMIN_PREVIEW_ENABLED: "true", ADMANTUM_ENABLED: undefined }, async () => {
      vi.mocked(getSessionUser).mockResolvedValue({ id: UID, email: "admin@example.com" });
      vi.mocked(isAdminEmail).mockReturnValue(true);
      const response = await GET();
      expect(response.status).toBe(200);
      const data = (await response.json()) as { url: string; previewOnly: boolean };
      expect(data.previewOnly).toBe(true);
      expect(new URL(data.url).searchParams.get("appid")).toBe("53190");
      expect(new URL(data.url).searchParams.get("uid")).toBe(UID);
    });
  });
});
