import { describe, expect, it } from "vitest";
import { ADGEM_WALL_BASE_URL, adgemAppId, buildAdgemWallUrl } from "../wall";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("buildAdgemWallUrl", () => {
  it("contains appid=33683", () => {
    const url = new URL(buildAdgemWallUrl({ playerId: UID }));
    expect(url.origin + url.pathname).toBe(ADGEM_WALL_BASE_URL);
    expect(url.searchParams.get("appid")).toBe("33683");
  });

  it("playerid exactly equals the authenticated UUID", () => {
    const url = new URL(buildAdgemWallUrl({ playerId: UID }));
    expect(url.searchParams.get("playerid")).toBe(UID);
  });

  it("caller cannot override playerid (no override parameter exists)", () => {
    // The builder accepts ONLY playerId — there is no way to pass appid,
    // secrets, or extra params through it.
    const url = new URL(buildAdgemWallUrl({ playerId: UID }));
    expect([...url.searchParams.keys()].sort()).toEqual(["appid", "playerid"]);
  });

  it("URL-encodes hostile playerId values instead of injecting params", () => {
    const hostile = "x&appid=evil&playerid=y";
    const url = new URL(buildAdgemWallUrl({ playerId: hostile }));
    expect(url.searchParams.get("playerid")).toBe(hostile);
    expect(url.searchParams.get("appid")).toBe("33683");
  });

  it("throws on empty playerId (never mints an anonymous wall)", () => {
    expect(() => buildAdgemWallUrl({ playerId: "" })).toThrow();
  });

  it("no Postback Key or secret material in the URL", () => {
    const url = buildAdgemWallUrl({ playerId: UID });
    expect(url).not.toMatch(/ADGEM_POSTBACK_KEY|secure|secret|signature|hash/i);
  });

  it("respects ADGEM_APP_ID override, defaults to 33683", () => {
    const prev = process.env.ADGEM_APP_ID;
    try {
      delete process.env.ADGEM_APP_ID;
      expect(adgemAppId()).toBe("33683");
      process.env.ADGEM_APP_ID = "99999";
      expect(adgemAppId()).toBe("99999");
      expect(new URL(buildAdgemWallUrl({ playerId: UID })).searchParams.get("appid")).toBe("99999");
    } finally {
      if (prev === undefined) delete process.env.ADGEM_APP_ID;
      else process.env.ADGEM_APP_ID = prev;
    }
  });
});
