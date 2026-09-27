import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../../..");

describe("auth gating (case 9: no session → no wall for anyone)", () => {
  it("requireUserId throws when there is no authenticated user", async () => {
    // No Supabase env in tests → getSessionUser() is null → must throw, never
    // return a fallback id the browser could abuse.
    const { requireUserId } = await import("@/lib/auth/server");
    await expect(requireUserId()).rejects.toThrowError(/Authentication required/);
  });
});

describe("client reward creation is impossible (case 10)", () => {
  it("RLS migration grants NO write access on financial tables to normal users", () => {
    const sql = readFileSync(resolve(root, "database/migrations/002_cpx_provider.sql"), "utf8");
    // Users may only SELECT their own ledger rows…
    expect(sql).toMatch(/create policy "ledger_select_own"[\s\S]*?for select to authenticated/);
    // …and there must be no INSERT/UPDATE/DELETE policy for anon/authenticated
    // on ledger_transactions or provider_events (service role bypasses RLS).
    const grants = [...sql.matchAll(/create policy "([^"]+)" on (\w+)\s+for (select|insert|update|delete|all)[\s\S]*?to ([\w,\s]+);/g)];
    for (const [, name, table, op, roles] of grants) {
      if ((table === "ledger_transactions" || table === "provider_events" || table === "fraud_flags") && op !== "select") {
        throw new Error(`unexpected write policy ${name} on ${table} for ${roles}`);
      }
      if (table === "provider_events" || table === "fraud_flags") {
        throw new Error(`unexpected policy ${name} on ${table}: normal users must have no access at all`);
      }
    }
  });

  it("client-safe CPX module references no secrets", () => {
    const shared = readFileSync(resolve(root, "lib/providers/cpx/shared.ts"), "utf8");
    expect(shared).not.toMatch(/process\.env\.(CPX_APP_SECURE_HASH|CPX_POSTBACK_SECRET)/);
    expect(shared).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(shared).not.toMatch(/from ["']node:crypto["']/);
  });
});
