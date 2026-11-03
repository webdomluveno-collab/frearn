import { describe, expect, it } from "vitest";
import { processTheoremreachCallback, type NormalizedTheoremreachCallback, type TheoremreachStore } from "../process";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const callback = (overrides: Partial<NormalizedTheoremreachCallback> = {}): NormalizedTheoremreachCallback => ({
  txId: "tx-reward-1", userId: UID, reversal: false, userRewardCents: 70, publisherRevenueCents: 100, ...overrides,
});

class MemoryStore implements TheoremreachStore {
  rows = new Map<string, { id: string; outcome: "rewarded" | "duplicate" }>();
  reversalPending = false;
  async processRewardAtomically(input: NormalizedTheoremreachCallback) {
    if (input.reversal) throw new Error("not called for reversal");
    if (this.reversalPending) return { outcome: "reversal_pending" as const, ledgerId: null };
    const existing = this.rows.get(input.txId);
    if (existing) return { outcome: "duplicate" as const, ledgerId: existing.id };
    const id = `ledger-${this.rows.size + 1}`;
    this.rows.set(input.txId, { id, outcome: "rewarded" });
    return { outcome: "rewarded" as const, ledgerId: id };
  }
  async processReversalAtomically(): Promise<never> {
    throw new Error("not used in this test");
  }
  async processBanAtomically(): Promise<never> {
    throw new Error("not used in this test");
  }
}

describe("TheoremReach application gate", () => {
  it("delegates verified rewards to one atomic store operation", async () => {
    const store = new MemoryStore();
    expect(await processTheoremreachCallback(store, callback())).toEqual({ outcome: "rewarded", ledgerId: "ledger-1" });
    expect(await processTheoremreachCallback(store, callback())).toEqual({ outcome: "duplicate", ledgerId: "ledger-1" });
    expect(store.rows.size).toBe(1);
  });

  it("never sends Reward Callback reversals to the money RPC", async () => {
    const store = new MemoryStore();
    expect(await processTheoremreachCallback(store, callback({ reversal: true }))).toEqual({ outcome: "reversal_disabled" });
    expect(store.rows.size).toBe(0);
  });

  it("returns a pending reversal as a durable no-write outcome", async () => {
    const store = new MemoryStore();
    store.reversalPending = true;
    expect(await processTheoremreachCallback(store, callback())).toEqual({ outcome: "reversal_pending" });
    expect(store.rows.size).toBe(0);
  });

  it.each([
    { userRewardCents: 0 }, { userRewardCents: -1 }, { userRewardCents: 1.5 }, { publisherRevenueCents: -1 },
  ])("rejects invalid normalized amounts before the store", async (amounts) => {
    const store = new MemoryStore();
    expect(await processTheoremreachCallback(store, callback(amounts as Partial<NormalizedTheoremreachCallback>))).toMatchObject({ outcome: "rejected", reason: expect.any(String) });
    expect(store.rows.size).toBe(0);
  });
});
