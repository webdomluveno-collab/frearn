import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/providers/adgem/wall/route";

describe("GET /api/providers/adgem/wall", () => {
  it("unauthenticated request gets no personalized wall URL", async () => {
    // No Supabase env in tests → getSessionUser() is null → 401, no URL.
    const res = await GET();
    expect(res.status).toBe(401);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.url).toBeUndefined();
    expect(data.error).toBe("unauthenticated");
  });
});
