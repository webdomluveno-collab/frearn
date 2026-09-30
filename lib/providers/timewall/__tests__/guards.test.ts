import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../../..");

function codeWithoutComments(file: string): string {
  const src = readFileSync(file, "utf8");
  return src
    .replace(/\/\*\*?[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, " ");
}

describe("TimeWall wall implementation cannot leak server secrets", () => {
  const files = [
    "lib/providers/timewall/wall.ts",
    "app/api/providers/timewall/wall/route.ts",
  ];
  it("no secret names, hashes, or service-role references in wall code", () => {
    for (const f of files) {
      const code = codeWithoutComments(resolve(root, f));
      expect(`${f}: ${code}`).not.toMatch(
        /TIMEWALL_POSTBACK_SECRET|ADGEM_POSTBACK_KEY|CPX_APP_SECURE_HASH|CPX_POSTBACK_SECRET|SUPABASE_SERVICE_ROLE|service_role|createHmac|createHash|timingSafeEqual/i
      );
    }
  });

  it("registry entry references no TimeWall secret (only the public wall URL helper)", () => {
    const code = codeWithoutComments(resolve(root, "lib/providers/index.ts"));
    expect(code).not.toMatch(/TIMEWALL_POSTBACK_SECRET/i);
  });

  it("Earn UI offers no working TimeWall entry while the wall is unavailable", () => {
    const tabs = codeWithoutComments(resolve(root, "components/earn-provider-tabs.tsx"));
    const lower = tabs.toLowerCase();
    // No tab, panel, iframe, or wall component for TimeWall may exist.
    expect(lower).not.toMatch(/role="tab"[^>]*timewall|timewall[^>]*role="tab"/);
    expect(lower).not.toMatch(/timewallofferwall|timewall.*iframe|iframe.*timewall/);
    expect(lower).not.toMatch(/timewall.*wall\.route|buildtimewallwallurl/);
    // Any remaining mention must be an honest pending-approval status row,
    // never a working-looking earning source.
    for (const line of lower.split("\n")) {
      if (line.includes("timewall")) {
        expect(line).toMatch(/pending approval|coming later|unavailable/);
      }
    }
  });
});

describe("TimeWall money code applies no second multiplier", () => {
  const files = [
    "lib/providers/timewall/shared.ts",
    "lib/providers/timewall/server.ts",
    "lib/providers/timewall/process.ts",
    "lib/db/timewall-store.ts",
    "app/api/providers/timewall/postback/route.ts",
  ];
  it("user reward flows verbatim from `currency` (behavioral proof in process tests)", () => {
    for (const f of files) {
      const code = codeWithoutComments(resolve(root, f));
      // No 70%/0.7 factor, no /100 division, no *100 scaling anywhere near money.
      expect(`${f}: ${code}`).not.toMatch(/\*\s*70\b|\*\s*0\.7\b|0\.7\s*\*|\/\s*100\b|\*\s*100\b/);
    }
  });
});
