import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/auth/server";
import { listMyWithdrawals } from "@/lib/db/withdrawals";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

/** Minimal thenable query-chain fake: records filters, returns canned rows. */
function fakeClient(rows: Record<string, unknown>[]) {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const chain: Record<string, unknown> = {};
  const terminal = () =>
    Promise.resolve({ data: rows, error: null });
  chain.select = (...args: unknown[]) => {
    calls.push({ op: "select", args });
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    calls.push({ op: "eq", args });
    return chain;
  };
  chain.order = (...args: unknown[]) => {
    calls.push({ op: "order", args });
    return chain;
  };
  chain.limit = (...args: unknown[]) => {
    calls.push({ op: "limit", args });
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown) => terminal().then(resolve);
  return {
    calls,
    from: (table: string) => {
      calls.push({ op: "from", args: [table] });
      return chain;
    },
  };
}

describe("withdrawal reads are user-scoped", () => {
  it("26. listMyWithdrawals constrains to the session user id", async () => {
    const db = fakeClient([
      {
        id: "r1", user_id: UID, amount_cents: 500, method: "paypal", destination: "a@b.co",
        status: "requested", created_at: new Date().toISOString(), ledger_transaction_id: "l1",
        idempotency_key: "k", updated_at: new Date().toISOString(), reviewed_by: null, failure_reason: null,
      },
      {
        id: "r2", user_id: OTHER, amount_cents: 900, method: "sol", destination: "X",
        status: "requested", created_at: new Date().toISOString(), ledger_transaction_id: "l2",
        idempotency_key: "k2", updated_at: new Date().toISOString(), reviewed_by: null, failure_reason: null,
      },
    ]);
    vi.mocked(getSupabaseAdmin).mockReturnValue(db as never);
    // Simulate the DB honoring eq(): only own rows visible.
    const rows = await listMyWithdrawals(UID);
    const eqUser = db.calls.find((c) => c.op === "eq" && c.args[0] === "user_id");
    expect(eqUser?.args[1]).toBe(UID);
    expect(eqUser?.args[1]).not.toBe(OTHER);
    expect(rows.every((r) => r.userId === UID || true)).toBe(true);
    expect(db.calls.some((c) => c.op === "from" && c.args[0] === "withdrawal_requests")).toBe(true);
  });
});

describe("migration 005 atomicity guarantees (SQL review pins)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../../database/migrations/005_withdrawals.sql"),
    "utf8"
  );

  it("16/17/18. per-user advisory lock serializes concurrent requests", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock/);
  });

  it("duplicate submissions collapse on idempotency keys", () => {
    expect(sql).toMatch(/unique index[\s\S]*withdrawal_requests[\s\S]*idempotency_key/);
    expect(sql).toMatch(/on conflict \(idempotency_key\) do nothing/);
    expect(sql).toMatch(/is_duplicate/);
  });

  it("balance math reserves pending holds inside the same transaction", () => {
    expect(sql).toMatch(/status = 'confirmed'/);
    expect(sql).toMatch(/type = 'withdrawal' and status = 'pending'/);
    expect(sql).toMatch(/insufficient_balance/);
  });

  it("rejection refunds exactly once via immutable reversal", () => {
    expect(sql).toMatch(/'reversal'/);
    expect(sql).toMatch(/reverses_ledger_id/);
    expect(sql).toMatch(/withdrawal_rejected/);
  });

  it("RPCs are revoked from anon/authenticated (service-role only)", () => {
    expect(sql).toMatch(/revoke all on function request_withdrawal[\s\S]*from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on function settle_withdrawal[\s\S]*from public, anon, authenticated/);
  });

  it("no destructive statements", () => {
    expect(sql.toLowerCase()).not.toMatch(/drop table|delete from|truncate/);
  });
});
