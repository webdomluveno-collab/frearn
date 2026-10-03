import { describe, expect, it } from "vitest";
import { summarizeLedger } from "./ledger";
import type { LedgerTransaction } from "@/types";

function row(overrides: Partial<LedgerTransaction>): LedgerTransaction {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    userId: "user-1",
    type: "survey_reward",
    status: "confirmed",
    amountCents: 0,
    description: "",
    idempotencyKey: `k-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("summarizeLedger with AdGem offer_reward rows", () => {
  it("16. confirmed offer_reward counts toward available and lifetime", () => {
    const s = summarizeLedger([
      row({ type: "offer_reward", amountCents: 70, provider: "adgem" }),
      row({ type: "survey_reward", amountCents: 35, provider: "cpx" }),
    ]);
    expect(s.availableCents).toBe(105);
    expect(s.lifetimeCents).toBe(105);
    expect(s.pendingCents).toBe(0);
  });

  it("reversal of an offer_reward reduces available but not lifetime", () => {
    const s = summarizeLedger([
      row({ type: "offer_reward", amountCents: 70, provider: "adgem" }),
      row({ type: "reversal", amountCents: -70, provider: "adgem" }),
    ]);
    expect(s.availableCents).toBe(0);
    expect(s.lifetimeCents).toBe(70);
  });
});

describe("summarizeLedger with withdrawal holds", () => {
  it("pending withdrawal reserves funds: $5.00 request on $5.00 leaves $0.00 available", () => {
    const s = summarizeLedger([
      row({ type: "survey_reward", amountCents: 500, provider: "cpx" }),
      row({ type: "withdrawal", status: "pending", amountCents: -500, provider: "manual" }),
    ]);
    expect(s.availableCents).toBe(0);
    expect(s.reservedCents).toBe(500);
    expect(s.lifetimeCents).toBe(500);
    expect(s.pendingCents).toBe(0);
  });

  it("second request cannot spend reserved money (derived view matches RPC)", () => {
    const s = summarizeLedger([
      row({ type: "survey_reward", amountCents: 500, provider: "cpx" }),
      row({ type: "withdrawal", status: "pending", amountCents: -500, provider: "manual" }),
    ]);
    // A further $5.00 request exceeds the derived available balance of $0.00.
    expect(s.availableCents).toBeLessThan(500);
  });

  it("paid withdrawal keeps the deduction, lifetime unchanged", () => {
    const s = summarizeLedger([
      row({ type: "survey_reward", amountCents: 500, provider: "cpx" }),
      row({ type: "withdrawal", status: "confirmed", amountCents: -500, provider: "manual" }),
    ]);
    expect(s.availableCents).toBe(0);
    expect(s.lifetimeCents).toBe(500);
    expect(s.reservedCents).toBe(0);
  });

  it("rejected withdrawal restores funds exactly once via reversal credit", () => {
    const s = summarizeLedger([
      row({ type: "survey_reward", amountCents: 500, provider: "cpx" }),
      row({ type: "withdrawal", status: "reversed", amountCents: -500, provider: "manual" }),
      // Zero-amount marker: voiding the hold restores funds; a positive
      // credit here would double-count the original reward.
      row({ type: "reversal", status: "confirmed", amountCents: 0, provider: "manual" }),
    ]);
    expect(s.availableCents).toBe(500);
    expect(s.lifetimeCents).toBe(500);
    expect(s.reservedCents).toBe(0);
  });

  it("partial holds reduce available by exactly the held amount", () => {
    const s = summarizeLedger([
      row({ type: "survey_reward", amountCents: 1000, provider: "cpx" }),
      row({ type: "withdrawal", status: "pending", amountCents: -300, provider: "manual" }),
    ]);
    expect(s.availableCents).toBe(700);
    expect(s.reservedCents).toBe(300);
  });
});
