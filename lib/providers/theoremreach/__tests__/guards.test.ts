import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../../..");

function src(relative: string): string {
  return readFileSync(resolve(root, relative), "utf8");
}

function codeWithoutComments(file: string): string {
  return src(file)
    .replace(/\/\*\*?[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, " ");
}

const OWN = [
  "lib/providers/theoremreach/shared.ts",
  "lib/providers/theoremreach/server.ts",
  "app/api/providers/theoremreach/wall/route.ts",
  "app/api/providers/theoremreach/postback/route.ts",
  "app/api/providers/theoremreach/event-webhook/route.ts",
];

describe("TheoremReach Phase 1 secret containment", () => {
  it("Secret Key name never appears in client-safe or UI code", () => {
    for (const f of [
      "lib/providers/theoremreach/shared.ts",
      "components/earn-provider-tabs.tsx",
      "components/theoremreach-wall.tsx",
      "app/dashboard/earn/page.tsx",
      "app/dashboard/page.tsx",
    ]) {
      expect(`${f}: ${codeWithoutComments(f)}`).not.toMatch(/THEOREMREACH_SECRET_KEY/i);
    }
  });

  it("no NEXT_PUBLIC_THEOREMREACH_* variable is read anywhere", () => {
    for (const f of [...OWN, "lib/providers/index.ts"]) {
      expect(`${f}: ${codeWithoutComments(f)}`).not.toMatch(/NEXT_PUBLIC_THEOREMREACH/i);
    }
  });

  it("callback and Event Webhook routes never log payload contents", () => {
    for (const file of [
      "app/api/providers/theoremreach/postback/route.ts",
      "app/api/providers/theoremreach/event-webhook/route.ts",
    ]) {
      expect(codeWithoutComments(file)).not.toMatch(/console\.(log|warn|error|info|debug)/);
    }
  });

  it("server-only module is isolated from client bundles", () => {
    expect(src("lib/providers/theoremreach/server.ts")).toMatch(/import "server-only"/);
    // Registry reads env inline (CPX pattern) instead of importing server.ts.
    expect(codeWithoutComments("lib/providers/index.ts")).not.toMatch(
      /from ["']\.\/theoremreach\/server["']/
    );
  });
});

describe("TheoremReach Phase 1 writes no money", () => {
  it("no ledger/provider-event/fraud writes in TheoremReach runtime files", () => {
    for (const f of OWN) {
      const code = `${f}: ${codeWithoutComments(f)}`;
      expect(code).not.toMatch(/ledger_transactions|provider_events|insertLedger|insertProviderEvent|insertFraudFlag/i);
    }
  });

  it("no credit/debit outcome vocabulary in non-route TheoremReach files", () => {
    const nonRoute = OWN.filter(f => !f.endsWith("/route.ts"));
    for (const f of nonRoute) {
      const code = `${f}: ${codeWithoutComments(f)}`;
      expect(code).not.toMatch(/"credited"|"reversed"|:reward|:reversal/);
    }
  });
});

describe("TheoremReach Earn UI containment", () => {
  it("Earn UI launch path is explicitly gated and server-minted", () => {
    const tabs = codeWithoutComments("components/earn-provider-tabs.tsx").toLowerCase();
    expect(tabs).toMatch(/theoremreachlive/);
    expect(tabs).toMatch(/theoremreach-wall/);
    expect(tabs).not.toMatch(/theoremreach_(api|secret|placement)/i);
    expect(tabs).not.toMatch(/respondent_entry|createhmac|hash=/i);
    const earn = codeWithoutComments("app/dashboard/earn/page.tsx").toLowerCase();
    expect(earn).toMatch(/istheoremreachwallenabled/);
    const dash = codeWithoutComments("app/dashboard/page.tsx").toLowerCase();
    expect(dash).not.toMatch(/theoremreach/);
    const wall = codeWithoutComments("components/theoremreach-wall.tsx");
    expect(wall).toMatch(/\/api\/providers\/theoremreach\/wall/);
    expect(wall).not.toMatch(/THEOREMREACH_(API|SECRET|PLACEMENT)/i);
  });
});
