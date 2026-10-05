import { describe, expect, it, vi } from "vitest";
import { buildTimewallWallUrl, isTimewallWallAvailable } from "../wall";

vi.mock("@/lib/auth/server", () => ({ getSessionUser: vi.fn() }));

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

describe("TimeWall wall availability (live for authenticated users)", () => {
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

describe("GET /api/providers/timewall/wall", () => {
  it("unauthenticated callers get 401 and no URL", async () => {
    const { getSessionUser } = await import("@/lib/auth/server");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    try {
      const { GET } = await import("@/app/api/providers/timewall/wall/route");
      const res = await GET();
      expect(res.status).toBe(401);
      expect(((await res.json()) as { url?: string }).url).toBeUndefined();
    } finally {
      vi.mocked(getSessionUser).mockReset();
    }
  });

  it("authenticated users obtain a URL built from their own session UUID", async () => {
    const { getSessionUser } = await import("@/lib/auth/server");
    vi.mocked(getSessionUser).mockResolvedValue({ id: UID, email: "user@example.com" });
    const prev = process.env.TIMEWALL_WALL_URL;
    process.env.TIMEWALL_WALL_URL = "https://timewall.io/users/login?oid=6154a2b1f8661a69";
    try {
      const { GET } = await import("@/app/api/providers/timewall/wall/route");
      // The route takes no request input: there is no query/body channel that
      // could replace the session UUID.
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      const data = (await res.json()) as { url: string };
      const url = new URL(data.url);
      expect(url.searchParams.get("oid")).toBe("6154a2b1f8661a69");
      expect(url.searchParams.get("uid")).toBe(UID);
      expect(url.searchParams.has("userid")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.TIMEWALL_WALL_URL;
      else process.env.TIMEWALL_WALL_URL = prev;
      vi.mocked(getSessionUser).mockReset();
    }
  });

  it("configured wall without session still denies (auth checked first)", async () => {
    const { getSessionUser } = await import("@/lib/auth/server");
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const prev = process.env.TIMEWALL_WALL_URL;
    process.env.TIMEWALL_WALL_URL = "https://timewall.io/users/login?oid=6154a2b1f8661a69";
    try {
      const { GET } = await import("@/app/api/providers/timewall/wall/route");
      const res = await GET();
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.TIMEWALL_WALL_URL;
      else process.env.TIMEWALL_WALL_URL = prev;
      vi.mocked(getSessionUser).mockReset();
    }
  });
});
