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
];

describe("TheoremReach Phase 1 secret containment", () => {
  it("Secret Key name never appears in client-safe or UI code", () => {
    for (const f of [
      "lib/providers/theoremreach/shared.ts",
      "components/earn-provider-tabs.tsx",
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

  it("postback route never logs callback contents", () => {
    expect(codeWithoutComments("app/api/providers/theoremreach/postback/route.ts")).not.toMatch(
      /console\.(log|warn|error|info|debug)/
    );
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

  it("no credit/debit outcome vocabulary in TheoremReach runtime files", () => {
    for (const f of OWN) {
      const code = `${f}: ${codeWithoutComments(f)}`;
      expect(code).not.toMatch(/"credited"|"reversed"|:reward|:reversal/);
    }
  });
});

describe("TheoremReach Phase 1 Earn UI containment", () => {
  it("Earn UI offers no working TheoremReach launch path", () => {
    const tabs = codeWithoutComments("components/earn-provider-tabs.tsx").toLowerCase();
    expect(tabs).not.toMatch(/theoremreach/);
    const earn = codeWithoutComments("app/dashboard/earn/page.tsx").toLowerCase();
    expect(earn).not.toMatch(/theoremreach/);
    const dash = codeWithoutComments("app/dashboard/page.tsx").toLowerCase();
    expect(dash).not.toMatch(/theoremreach/);
  });
});
