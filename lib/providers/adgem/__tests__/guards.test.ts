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

describe("AdGem 70-multiplier is never applied a second time", () => {
  const files = [
    "lib/providers/adgem/shared.ts",
    "lib/providers/adgem/server.ts",
    "lib/providers/adgem/process.ts",
    "lib/db/adgem-store.ts",
    "app/api/providers/adgem/postback/route.ts",
  ];
  it("no second multiplier/division anywhere near AdGem money code", () => {
    for (const f of files) {
      const code = codeWithoutComments(resolve(root, f));
      expect(`${f}: ${code}`).not.toMatch(/\*\s*70\b|\*\s*0\.7\b|0\.7\s*\*|\/\s*100\b|\*\s*100\b/);
    }
    // Behavioral proof lives in process.test.ts: amount=35 → +35¢, amount=70 → +70¢ (not 4900¢).
  });
});
