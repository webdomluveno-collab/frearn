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
    "components/timewall-wall.tsx",
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

  it("Earn UI exposes TimeWall as a normal live provider", () => {
    const tabs = codeWithoutComments(resolve(root, "components/earn-provider-tabs.tsx"));
    const lower = tabs.toLowerCase();
    // TimeWall is live for all authenticated users: the tab is unconditional.
    expect(lower).toMatch(/"timewall"/);
    // No test-gating remains: no test-user prop, no test UUID, no hidden tab.
    expect(tabs).not.toMatch(/timewallTestAccess/i);
    expect(tabs).not.toMatch(/TIMEWALL_TEST_USER_ID/i);
    expect(tabs).not.toMatch(/b02fda61-37ef-4d61-900b-5b2a747e29ec/i);
    // No test-only or unavailable copy may remain in the Earn UI.
    expect(lower).not.toMatch(/test access/);
    expect(lower).not.toMatch(/currently unavailable/);
    expect(lower).not.toMatch(/coming soon/);
    // The wall opens in a new tab: no TimeWall iframe may be mounted.
    expect(lower).not.toMatch(/timewall.*iframe|iframe.*timewall/);
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
