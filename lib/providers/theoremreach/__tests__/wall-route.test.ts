import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
}));

import { GET } from "@/app/api/providers/theoremreach/wall/route";
import { getSessionUser } from "@/lib/auth/server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_UID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
const mockedSession = vi.mocked(getSessionUser);

const KEYS = [
  "THEOREMREACH_API_KEY",
  "THEOREMREACH_SECRET_KEY",
  "THEOREMREACH_PLACEMENT_ID",
  "THEOREMREACH_POSTBACK_ENABLED",
  "THEOREMREACH_WALL_ENABLED",
  "THEOREMREACH_REWARD_PROCESSING_ENABLED",
  "THEOREMREACH_PILOT_ENABLED",
  "THEOREMREACH_PILOT_USER_IDS",
  "THEOREMREACH_PILOT_DEBUG_ENABLED",
] as const;

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
  THEOREMREACH_POSTBACK_ENABLED: "true",
  THEOREMREACH_WALL_ENABLED: "true",
  THEOREMREACH_REWARD_PROCESSING_ENABLED: "true",
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

  it("503 when the wall gate or reward gate is off", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "t@example.com" });
    await withEnv({ ...FULL_ENV, THEOREMREACH_WALL_ENABLED: undefined }, async () => {
      expect((await GET()).status).toBe(503);
    });
    await withEnv({ ...FULL_ENV, THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined }, async () => {
      expect((await GET()).status).toBe(503);
    });
  });

  it("503 when postback is off in both public and pilot modes", async () => {
    await withEnv({ ...FULL_ENV, THEOREMREACH_POSTBACK_ENABLED: undefined }, async () => {
      mockedSession.mockResolvedValue({ id: UID, email: "public@example.com" });
      expect((await GET()).status).toBe(503);
    });
    await withEnv(
      {
        ...FULL_ENV,
        THEOREMREACH_POSTBACK_ENABLED: undefined,
        THEOREMREACH_WALL_ENABLED: undefined,
        THEOREMREACH_PILOT_ENABLED: "true",
        THEOREMREACH_PILOT_USER_IDS: UID,
      },
      async () => {
        mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
        expect((await GET()).status).toBe(503);
      }
    );
  });

  it("503 reports a safe, specific cause for a disabled debug pilot", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: undefined,
      THEOREMREACH_PILOT_USER_IDS: UID,
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      const data = (await res.json()) as { error: string; reason: string; url?: string };
      expect(data).toEqual({
        error: "wall_unavailable",
        reason: "pilot_debug_and_reward_processing_disabled",
        diagnostics_version: "allowlist-v8",
      });
      expect(data.url).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain("test-secret-for-wall-route");
    });
  });

  it("503 identifies an allowlist mismatch without returning user ids", async () => {
    mockedSession.mockResolvedValue({ id: OTHER_UID, email: "other@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: UID,
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      const data = (await res.json()) as { reason: string };
      expect(data.reason).toBe("pilot_user_not_allowlisted");
      expect(JSON.stringify(data)).not.toContain(UID);
      expect(JSON.stringify(data)).not.toContain(OTHER_UID);
    });
  });

  it("accepts a JSON-array allowlist in debug mode without enabling money", async () => {
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: JSON.stringify([UID]),
    }, async () => {
      mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
      const res = await GET();
      expect(res.status).toBe(200);
      const data = (await res.json()) as { url: string };
      expect(new URL(data.url).searchParams.get("debug")).toBe("true");

      mockedSession.mockResolvedValue({ id: OTHER_UID, email: "other@example.com" });
      const denied = await GET();
      expect(denied.status).toBe(503);
      expect((await denied.json()).reason).toBe("pilot_user_not_allowlisted");
    });
  });

  it("503 identifies a missing allowlist at runtime without revealing config", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: undefined,
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      const data = (await res.json()) as { reason: string };
      expect(data.reason).toBe("pilot_allowlist_missing_at_runtime");
      expect(JSON.stringify(data)).not.toContain(UID);
    });
  });

  it("503 identifies an invalid-format allowlist without echoing its contents", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: "\"not-a-uuid\"",
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      const data = (await res.json()) as { reason: string };
      expect(data.reason).toBe("pilot_allowlist_runtime_value_too_short");
      expect((data as { diagnostics_version: string }).diagnostics_version).toBe("allowlist-v8");
      expect(JSON.stringify(data)).not.toContain("not-a-uuid");
    });
  });

  it.each([
    { raw: `invalid ${UID} note`, expected: "pilot_allowlist_runtime_uuid_wrapped_unrecognized" },
    { raw: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx—`, expected: "pilot_allowlist_runtime_has_non_ascii" },
    { raw: "a-placeholder-value-that-contains-no-uuid", expected: "pilot_allowlist_runtime_has_no_uuid_text" },
  ])("503 diagnoses malformed runtime shape without revealing values: $expected", async ({ raw, expected }) => {
    mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: raw,
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      const data = (await res.json()) as { reason: string; diagnostics_version: string };
      expect(data).toMatchObject({ reason: expected, diagnostics_version: "allowlist-v8" });
      expect(JSON.stringify(data)).not.toContain(UID);
      expect(JSON.stringify(data)).not.toContain(raw);
    });
  });

  it("503 distinguishes missing wall credentials from a disabled pilot", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
    await withEnv({
      ...FULL_ENV,
      THEOREMREACH_API_KEY: undefined,
      THEOREMREACH_WALL_ENABLED: undefined,
      THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
      THEOREMREACH_PILOT_ENABLED: "true",
      THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
      THEOREMREACH_PILOT_USER_IDS: UID,
    }, async () => {
      const res = await GET();
      expect(res.status).toBe(503);
      expect((await res.json()).reason).toBe("wall_credentials_missing");
    });
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

  it("allows only the pilot UUID while public wall access is off", async () => {
    await withEnv(
      {
        ...FULL_ENV,
        THEOREMREACH_WALL_ENABLED: undefined,
        THEOREMREACH_PILOT_ENABLED: "true",
        THEOREMREACH_PILOT_USER_IDS: UID,
      },
      async () => {
        mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
        expect((await GET()).status).toBe(200);

        mockedSession.mockResolvedValue({ id: OTHER_UID, email: "other@example.com" });
        expect((await GET()).status).toBe(503);
      }
    );
  });

  it("debug pilot can open only a debug URL without reward processing", async () => {
    await withEnv(
      {
        ...FULL_ENV,
        THEOREMREACH_WALL_ENABLED: undefined,
        THEOREMREACH_REWARD_PROCESSING_ENABLED: undefined,
        THEOREMREACH_PILOT_ENABLED: "true",
        THEOREMREACH_PILOT_DEBUG_ENABLED: "true",
        THEOREMREACH_PILOT_USER_IDS: UID,
      },
      async () => {
        mockedSession.mockResolvedValue({ id: UID, email: "pilot@example.com" });
        const res = await GET();
        expect(res.status).toBe(200);
        const data = (await res.json()) as { url: string };
        expect(new URL(data.url).searchParams.get("debug")).toBe("true");

        mockedSession.mockResolvedValue({ id: OTHER_UID, email: "other@example.com" });
        expect((await GET()).status).toBe(503);
      }
    );
  });
});
