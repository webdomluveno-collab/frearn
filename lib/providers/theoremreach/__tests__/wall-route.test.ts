import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
}));

import { GET } from "@/app/api/providers/theoremreach/wall/route";
import { getSessionUser } from "@/lib/auth/server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const mockedSession = vi.mocked(getSessionUser);

const KEYS = ["THEOREMREACH_API_KEY", "THEOREMREACH_SECRET_KEY", "THEOREMREACH_PLACEMENT_ID"] as const;

async function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = process.env[k];
  try {
    for (const k of KEYS) {
      const v = vars[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k] as string;
    }
  }
}

const FULL_ENV = {
  THEOREMREACH_API_KEY: "TESTAPPKEY",
  THEOREMREACH_SECRET_KEY: "test-secret-for-wall-route",
  THEOREMREACH_PLACEMENT_ID: "TESTPLACEMENT",
};

describe("GET /api/providers/theoremreach/wall (Phase 1)", () => {
  it("401 when unauthenticated — no URL leaks", async () => {
    mockedSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.url).toBeUndefined();
  });

  it("503 when unconfigured (fail closed)", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "t@example.com" });
    await withEnv(
      { THEOREMREACH_API_KEY: undefined, THEOREMREACH_SECRET_KEY: undefined, THEOREMREACH_PLACEMENT_ID: undefined },
      async () => {
        const res = await GET();
        expect(res.status).toBe(503);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.url).toBeUndefined();
      }
    );
  });

  it("200 with signed session-UUID entry URL when configured", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "t@example.com" });
    await withEnv(FULL_ENV, async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const data = (await res.json()) as { url: string };
      const url = new URL(data.url);
      // Browser cannot supply/override identity: the route takes no input
      // and the UUID is the server session's own.
      expect(url.searchParams.get("user_id")).toBe(UID);
      expect(url.searchParams.get("external_id")).toBe(UID);
      expect(url.searchParams.get("exchange_rate")).toBe("70");
      expect(data.url).not.toContain("test-secret-for-wall-route");
    });
  });
});
