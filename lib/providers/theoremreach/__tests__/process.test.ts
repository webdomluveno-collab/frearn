import { describe, expect, it } from "vitest";
import { processTheoremreachCallback } from "../process";
import type { NormalizedTheoremreachCallback, TheoremreachStore } from "../process";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function callback(overrides: Partial<NormalizedTheoremreachCallback> = {}): NormalizedTheoremreachCallback {
  return {
    txId: "tx-reward-1",
    userId: UID,
    reversal: false,
    userRewardCents: 70,
    publisherRevenueCents: 100,
    ...overrides,
  };
}

class MemoryStore implements TheoremreachStore {
  profiles: Map<string, string> = new Map([[UID, UID]]);
  events: Array<{ txId: string; userId: string | null; eventType: string; processingStatus: string; userRewardCents: number; publisherRevenueCents: number }> = [];
  rewards: Map<string, { id: string; userId: string; amountCents: number; publisherRevenueCents: number; status: string }> = new Map();
  reversals: Map<string, { id: string; userId: string; amountCents: number }> = new Map();
  ledger: Array<{ id: string; userId: string; type: string; amountCents: number; idempotencyKey: string; providerTransactionId: string; publisherRevenueCents: number }> = [];
  fraudFlags: Array<{ userId: string; reason: string; severity: string }> = [];

  async findProfile(userId: string) {
    return this.profiles.has(userId) ? { id: userId } : null;
  }

  async insertProviderEvent(row: any) {
    const existing = this.events.find((e) => e.txId === row.externalEventId);
    if (existing) return { inserted: false };
    this.events.push({
      txId: row.externalEventId,
      userId: row.userId,
      eventType: row.eventType,
      processingStatus: row.processingStatus,
      userRewardCents: row.userRewardCents,
      publisherRevenueCents: row.publisherRevenueCents,
    });
    return { inserted: true };
  }

  async findProviderEvent(txId: string) {
    const e = this.events.find((ev) => ev.txId === txId);
    if (!e) return null;
    return {
      userId: e.userId,
      eventType: e.eventType,
      userRewardCents: e.userRewardCents,
      publisherRevenueCents: e.publisherRevenueCents,
      processingStatus: e.processingStatus,
    };
  }

  async markEventProcessed(txId: string, processingStatus: string, error: string | null) {
    const e = this.events.find((ev) => ev.txId === txId);
    if (e) {
      e.processingStatus = processingStatus;
    }
  }

  async findRewardByTxId(txId: string) {
    return this.rewards.get(txId) ?? null;
  }

  async hasReversalForTxId(txId: string) {
    return this.reversals.has(txId);
  }

  async insertLedger(row: any) {
    if (this.ledger.some((l) => l.idempotencyKey === row.idempotencyKey)) {
      return { id: "", inserted: false };
    }
    const id = `ledger-${this.ledger.length + 1}`;
    this.ledger.push({
      id,
      userId: row.userId,
      type: row.type,
      amountCents: row.amountCents,
      idempotencyKey: row.idempotencyKey,
      providerTransactionId: row.providerTransactionId,
      publisherRevenueCents: row.publisherRevenueCents,
      metadata: row.metadata,
    });
    if (row.type === "reversal") {
      this.reversals.set(row.providerTransactionId, { id, userId: row.userId, amountCents: row.amountCents });
    } else {
      this.rewards.set(row.providerTransactionId, {
        id,
        userId: row.userId,
        amountCents: row.amountCents,
        publisherRevenueCents: row.publisherRevenueCents,
        status: row.status,
      });
    }
    return { id, inserted: true };
  }

  async insertFraudFlag(input: { userId: string; reason: string; severity: string }) {
    this.fraudFlags.push(input);
  }
}

function makeStore() {
  return new MemoryStore();
}

describe("Theoremreach callback processing (Phase 2, flag off)", () => {
  it("rewards a verified callback and persists ledger row", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(store, callback());
    expect(result.outcome).toBe("rewarded");
    expect(store.ledger.length).toBe(1);
    expect(store.ledger[0].amountCents).toBe(70);
    expect(store.ledger[0].type).toBe("survey_reward");
    expect(store.events.length).toBe(1);
    expect(store.events[0].processingStatus).toBe("processed");
  });

  it("rejects duplicate reward callback with same tx_id", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    const result = await processTheoremreachCallback(store, callback());
    expect(result.outcome).toBe("duplicate");
    expect(store.ledger.length).toBe(1);
  });

  it("rejects reward callback for unknown user", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(store, callback({ userId: "00000000-0000-0000-0000-000000000002" }));
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("unknown_user");
    expect(store.ledger.length).toBe(0);
  });

  it("reverses a confirmed reward", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    const result = await processTheoremreachCallback(store, callback({ reversal: true, userRewardCents: 70, publisherRevenueCents: 100 }));
    expect(result.outcome).toBe("reversed");
    const reversal = store.ledger.find((l) => l.type === "reversal");
    expect(reversal).toBeDefined();
    expect(reversal!.amountCents).toBe(-70);
    expect(store.ledger.length).toBe(2);
  });

  it("rejects reversal with no original reward (orphan)", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(store, callback({ reversal: true, txId: "tx-nonexistent" }));
    expect(result.outcome).toBe("orphan_reversal");
    expect(store.ledger.length).toBe(0);
  });

  it("rejects duplicate reversal", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    await processTheoremreachCallback(store, callback({ reversal: true, userRewardCents: 70, publisherRevenueCents: 100 }));
    const result = await processTheoremreachCallback(store, callback({ reversal: true, userRewardCents: 70, publisherRevenueCents: 100 }));
    expect(result.outcome).toBe("duplicate");
    const reversals = store.ledger.filter((l) => l.type === "reversal");
    expect(reversals.length).toBe(1);
  });

  it("rejects reversal for another user", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    const result = await processTheoremreachCallback(
      store,
      callback({ reversal: true, userRewardCents: 70, publisherRevenueCents: 100, userId: "00000000-0000-0000-0000-000000000002" })
    );
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("reversal_user_mismatch");
    expect(store.ledger.length).toBe(1);
  });

  it("rejects reversal with different amount than original", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    const result = await processTheoremreachCallback(
      store,
      callback({ reversal: true, userRewardCents: 80, publisherRevenueCents: 100 })
    );
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("reversal_amount_mismatch");
    expect(store.ledger.length).toBe(1);
  });

  it("rejects non-integer reward amount", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(
      store,
      callback({ userRewardCents: 70.5 as any, publisherRevenueCents: 100 })
    );
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("invalid_amount");
    expect(store.ledger.length).toBe(0);
  });

  it("rejects negative reward amount", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(
      store,
      callback({ userRewardCents: -5, publisherRevenueCents: 100 })
    );
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("invalid_amount");
    expect(store.ledger.length).toBe(0);
  });

  it("rejects reward with zero amount", async () => {
    const store = makeStore();
    const result = await processTheoremreachCallback(
      store,
      callback({ userRewardCents: 0, publisherRevenueCents: 100 })
    );
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toBe("invalid_amount");
    expect(store.ledger.length).toBe(0);
  });

  it("counts reversal as separate ledger row and does not debit original twice", async () => {
    const store = makeStore();
    await processTheoremreachCallback(store, callback());
    await processTheoremreachCallback(store, callback({ reversal: true, userRewardCents: 70, publisherRevenueCents: 100 }));
    const reversal = store.ledger.find((l) => l.type === "reversal");
    expect(reversal!.amountCents).toBe(-70);
    expect(reversal!.metadata!.reverses_ledger_id).toBe(store.ledger[0].id);
    expect(store.ledger.length).toBe(2);
  });
});
