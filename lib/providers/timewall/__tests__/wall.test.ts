import { describe, expect, it } from "vitest";
import { buildTimewallWallUrl, isTimewallTestUser, isTimewallWallAvailable } from "../wall";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function withWallUrl(value: string | undefined, fn: () => void) {
  const prev = process.env.TIMEWALL_WALL_URL;
  if (value === undefined) delete process.env.TIMEWALL_WALL_URL;
  else process.env.TIMEWALL_WALL_URL = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.TIMEWALL_WALL_URL;
    else process.env.TIMEWALL_WALL_URL = prev;
  }
}

describe("TimeWall wall availability (placement approved, test-gated)", () => {
  it("reports unavailable while no official Placement URL exists", () => {
    withWallUrl(undefined, () => {
      expect(isTimewallWallAvailable()).toBe(false);
      expect(() => buildTimewallWallUrl({ userId: UID })).toThrow(/not configured/);
    });
    withWallUrl("", () => {
      expect(isTimewallWallAvailable()).toBe(false);
    });
  });

  it("rejects non-https and malformed placement URLs", () => {
    withWallUrl("http://wall.example.com/x", () => {
      expect(isTimewallWallAvailable()).toBe(false);
    });
    withWallUrl("not-a-url", () => {
      expect(isTimewallWallAvailable()).toBe(false);
    });
  });

  it("attaches the session UUID as uid once the official URL is set", () => {
    withWallUrl("https://wall.example.com/placement/abc", () => {
      expect(isTimewallWallAvailable()).toBe(true);
      const url = new URL(buildTimewallWallUrl({ userId: UID }));
      expect(url.origin).toBe("https://wall.example.com");
      expect(url.searchParams.get("uid")).toBe(UID);
      expect(url.searchParams.has("userid")).toBe(false);
    });
  });

  it("preserves the official oid parameter and appends uid (regression)", () => {
    withWallUrl("https://timewall.io/users/login?oid=6154a2b1f8661a69", () => {
      expect(isTimewallWallAvailable()).toBe(true);
      expect(buildTimewallWallUrl({ userId: UID })).toBe(
        "https://timewall.io/users/login?oid=6154a2b1f8661a69&uid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
      );
      const url = new URL(buildTimewallWallUrl({ userId: UID }));
      expect(url.searchParams.get("oid")).toBe("6154a2b1f8661a69");
      expect(url.searchParams.get("uid")).toBe(UID);
      expect(url.searchParams.has("userid")).toBe(false);
    });
  });

  it("requires a userId (never mints an anonymous wall)", () => {
    withWallUrl("https://wall.example.com/placement/abc", () => {
      expect(() => buildTimewallWallUrl({ userId: "" })).toThrow();
    });
  });
});

const TEST_USER = "b02fda61-37ef-4d61-900b-5b2a747e29ec";

describe("isTimewallTestUser (controlled live-test gate)", () => {
  function withTestUser(value: string | undefined, fn: () => void) {
    const prev = process.env.TIMEWALL_TEST_USER_ID;
    if (value === undefined) delete process.env.TIMEWALL_TEST_USER_ID;
    else process.env.TIMEWALL_TEST_USER_ID = value;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.TIMEWALL_TEST_USER_ID;
      else process.env.TIMEWALL_TEST_USER_ID = prev;
    }
  }

  it("exact session UUID match only — no query/body/client override possible", () => {
    withTestUser(TEST_USER, () => {
      expect(isTimewallTestUser(TEST_USER)).toBe(true);
      expect(isTimewallTestUser("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(false);
      expect(isTimewallTestUser("")).toBe(false);
      expect(isTimewallTestUser(null)).toBe(false);
      expect(isTimewallTestUser(undefined)).toBe(false);
      // Near-miss values never match: no prefix, suffix, case, or whitespace leniency.
      expect(isTimewallTestUser(TEST_USER.toUpperCase())).toBe(false);
      expect(isTimewallTestUser(` ${TEST_USER} `)).toBe(false);
    });
  });

  it("fail closed when the test user is unconfigured", () => {
    withTestUser(undefined, () => {
      expect(isTimewallTestUser(TEST_USER)).toBe(false);
    });
    withTestUser("", () => {
      expect(isTimewallTestUser(TEST_USER)).toBe(false);
    });
    withTestUser("   ", () => {
      expect(isTimewallTestUser(TEST_USER)).toBe(false);
    });
  });
});

describe("GET /api/providers/timewall/wall", () => {
  it("unauthenticated callers get 401 and no URL", async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      const { GET } = await import("@/app/api/providers/timewall/wall/route");
      const res = await GET();
      expect(res.status).toBe(401);
    } finally {
      if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    }
  });
});
