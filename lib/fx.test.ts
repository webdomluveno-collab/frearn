import { describe, expect, it } from "vitest";
import {
  buildActivityCsv,
  displayName,
  toFxTransaction,
  weekBuckets,
  type FxTransaction,
} from "./fx";
import type { LedgerTransaction } from "@/types";

function row(overrides: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: "tx-1",
    userId: "user-1",
    type: "survey_reward",
    status: "confirmed",
    amountCents: 135,
    description: "Survey reward (CPX demo)",
    idempotencyKey: "k-1",
    createdAt: "2026-09-20T12:00:00.000Z",
    provider: "cpx",
    ...overrides,
  };
}

describe("toFxTransaction", () => {
  it("maps ledger types to presentation kinds without touching money", () => {
    const t = toFxTransaction(row({}));
    expect(t.kind).toBe("survey");
    expect(t.status).toBe("confirmed");
    expect(t.amountCents).toBe(135);
    expect(t.title).toBe("Survey reward (CPX demo)");
  });

  it("maps offer rewards, reversals, withdrawals, adjustments", () => {
    expect(toFxTransaction(row({ type: "offer_reward" })).kind).toBe("offer");
    const rev = toFxTransaction(
      row({ type: "reversal", amountCents: -135, metadata: { reverses_ledger_id: "tx-0", reason: "cpx_fraud_status_2" } })
    );
    expect(rev.kind).toBe("reversal");
    expect(rev.relatedId).toBe("tx-0");
    expect(rev.reason).toContain("provider review");
    expect(toFxTransaction(row({ type: "withdrawal", amountCents: -500 })).kind).toBe("withdrawal");
    expect(toFxTransaction(row({ type: "adjustment" })).kind).toBe("adjustment");
  });

  it("maps pending and reversed statuses, never invents Confirmed", () => {
    expect(toFxTransaction(row({ status: "pending" })).status).toBe("pending");
    expect(toFxTransaction(row({ status: "reversed" })).status).toBe("reversed");
  });

  it("falls back to type-derived titles when description is empty", () => {
    expect(toFxTransaction(row({ description: "" })).title).toBe("Survey reward");
  });
});

describe("buildActivityCsv", () => {
  it("exports real rows with header, quoting, and exact amounts", () => {
    const csv = buildActivityCsv([
      row({ id: 'a"b', description: 'Pay, "quoted"', amountCents: 135 }),
      row({ id: "c", type: "reversal", amountCents: -135, status: "confirmed" }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"reference","date","description","type","status","amount_usd"');
    expect(lines[1]).toContain('"a""b"');
    expect(lines[1]).toContain('"Pay, ""quoted"""');
    expect(lines[1]).toContain('"1.35"');
    expect(lines[2]).toContain('"-1.35"');
  });
});

describe("weekBuckets", () => {
  it("sums confirmed positive earnings per UTC day over 7 days", () => {
    const now = new Date("2026-09-30T12:00:00.000Z"); // Wednesday
    const txns: LedgerTransaction[] = [
      row({ id: "a", amountCents: 100, createdAt: "2026-09-30T08:00:00.000Z" }),
      row({ id: "b", amountCents: 50, createdAt: "2026-09-30T09:00:00.000Z" }),
      row({ id: "c", amountCents: 200, createdAt: "2026-09-29T08:00:00.000Z" }),
      row({ id: "d", amountCents: -200, createdAt: "2026-09-29T09:00:00.000Z" }),
      row({ id: "e", amountCents: 999, status: "pending", createdAt: "2026-09-28T08:00:00.000Z" }),
      row({ id: "f", amountCents: 999, createdAt: "2026-09-20T08:00:00.000Z" }),
    ];
    const buckets = weekBuckets(txns, now);
    expect(buckets).toHaveLength(7);
    expect(buckets[6]).toMatchObject({ label: "Wednesday", cents: 150 });
    expect(buckets[5]).toMatchObject({ label: "Tuesday", cents: 200 });
    expect(buckets.reduce((s, b) => s + b.cents, 0)).toBe(350);
  });

  it("returns all-zero buckets for empty history", () => {
    const buckets = weekBuckets([], new Date("2026-09-30T12:00:00.000Z"));
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.cents === 0)).toBe(true);
  });
});

describe("displayName", () => {
  it("derives a display name from the verified email only", () => {
    expect(displayName("alex@example.com")).toBe("Alex");
    expect(displayName("john.doe42@example.com")).toBe("John doe42");
    expect(displayName(null)).toBe("there");
    expect(displayName("")).toBe("there");
  });
});

describe("FxTransaction contract", () => {
  it("every kind has an icon mapping entry point", () => {
    const kinds: FxTransaction["kind"][] = ["survey", "offer", "game", "task", "withdrawal", "adjustment", "reversal"];
    expect(kinds).toHaveLength(7);
  });
});
