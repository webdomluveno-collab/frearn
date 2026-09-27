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
