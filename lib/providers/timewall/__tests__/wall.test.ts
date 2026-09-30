import { describe, expect, it } from "vitest";
import { buildTimewallWallUrl, isTimewallWallAvailable } from "../wall";

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

describe("TimeWall wall availability (placement pending approval)", () => {
  it("reports unavailable while no official Placement URL exists", () => {
    withWallUrl(undefined, () => {
      expect(isTimewallWallAvailable()).toBe(false);
      expect(() => buildTimewallWallUrl({ userId: UID })).toThrow(/pending approval/);
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

  it("attaches the session UUID as userid once the official URL is set", () => {
    withWallUrl("https://wall.example.com/placement/abc", () => {
      expect(isTimewallWallAvailable()).toBe(true);
      const url = new URL(buildTimewallWallUrl({ userId: UID }));
      expect(url.origin).toBe("https://wall.example.com");
      expect(url.searchParams.get("userid")).toBe(UID);
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
