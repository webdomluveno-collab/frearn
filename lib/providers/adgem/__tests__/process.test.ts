import { describe, expect, it } from "vitest";
import {
  processAdgemPostback,
  type AdgemEventInsert,
  type AdgemLedgerInsert,
  type AdgemStore,
  type AdgemStoredEvent,
} from "../process";
import type { AdgemPostbackBody } from "../shared";

const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER = "ffffffff-1111-2222-3333-444444444444";

/**
 * In-memory store mirroring production DB uniqueness exactly:
 * - unique (provider, external_event_id) on events,
 * - unique idempotency_key AND unique (provider, txn, type) on ledger rows.
 * Atomic check-then-insert (no awaits inside) models the DB constraint for
 * concurrent-duplicate testing.
 */
class MemoryAdgemStore implements AdgemStore {
  profiles = new Set<string>([USER]);
  events = new Map<string, AdgemEventInsert & { status: string | null }>();
  ledger: Array<AdgemLedgerInsert & { id: string }> = [];
  fraudFlags: Array<{ userId: string; reason: string }> = [];
  failLedgerInserts = 0;
  private seq = 0;
  private compositeKeys = new Set<string>();

  async findProfile(userId: string) {
    return this.profiles.has(userId) ? { id: userId } : null;
  }
  async insertProviderEvent(row: AdgemEventInsert) {
    const key = `${row.provider}:${row.externalEventId}`;
    if (this.events.has(key)) return { inserted: false };
    this.events.set(key, { ...row, status: null });
    return { inserted: true };
  }
  async findEventByRequestId(requestId: string): Promise<AdgemStoredEvent | null> {
    const e = this.events.get(`adgem:${requestId}`);
    if (!e) return null;
    const raw = e.rawPayload as Record<string, unknown>;
    return {
      userId: e.userId,
      conversionId: typeof raw.conversion_id === "string" ? raw.conversion_id : "",
    };
  }
  async markEventProcessed(requestId: string, processingStatus: string, error: string | null) {
    const e = this.events.get(`adgem:${requestId}`);
    if (e) {
      e.processingStatus = processingStatus;
      e.error = error;
      e.status = processingStatus;
    }
  }
  async findRewardByTxnRef(txnRef: string) {
    const r = this.ledger.find(
      (l) => l.provider === "adgem" && l.providerTransactionId === txnRef && l.type === "offer_reward"
    );
    return r ? { id: r.id, userId: r.userId, amountCents: r.amountCents } : null;
  }
  async insertLedgerReward(row: AdgemLedgerInsert) {
    if (this.failLedgerInserts > 0) {
      this.failLedgerInserts -= 1;
      throw new Error("transient db failure");
    }
    if (this.ledger.some((l) => l.idempotencyKey === row.idempotencyKey)) return { id: "", inserted: false };
    const composite = `${row.provider}|${row.providerTransactionId}|${row.type}`;
    if (this.compositeKeys.has(composite)) return { id: "", inserted: false };
    const id = `ledger-${++this.seq}`;
    this.ledger.push({ ...row, id });
    this.compositeKeys.add(composite);
    return { id, inserted: true };
  }
  async insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }) {
    this.fraudFlags.push({ userId: input.userId, reason: input.reason });
  }
  rewards() {
    return this.ledger.filter((l) => l.type === "offer_reward");
  }
}

function rewardBody(overrides: Partial<AdgemPostbackBody> = {}): AdgemPostbackBody {
  return {
    requestId: "req-001",
    timestamp: 1748365518,
    conversionId: "conv-001",
    playerId: USER,
    conversionType: "reward",
    amountRaw: 500,
    payoutCents: 150,
    offerId: "9087",
    goalId: "4521",
    goalName: "Reach Level 10",
    offerName: "Coin Master",
    campaignId: "6789",
    allGoalsCompleted: true,
    ...overrides,
  };
}

describe("processAdgemPostback — crediting", () => {
  it("1. amount=35 creates exactly one confirmed +35¢ offer_reward", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(store, rewardBody({ requestId: "req-35", conversionId: "conv-35", amountRaw: 35, payoutCents: 50 }));
    expect(res.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    const row = store.rewards()[0];
    expect(row.type).toBe("offer_reward");
    expect(row.status).toBe("confirmed");
    expect(row.provider).toBe("adgem");
    expect(row.amountCents).toBe(35);
    expect(row.userId).toBe(USER);
    expect(row.description).toContain("Coin Master");
    const event = store.events.get("adgem:req-35")!;
    expect(event.processingStatus).toBe("processed");
  });

  it("2. amount=70 credits +70¢ — the 70 multiplier is NOT applied twice", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-70", conversionId: "conv-70", amountRaw: 70 }));
    expect(store.rewards()[0].amountCents).toBe(70);
    expect(store.rewards()[0].amountCents).not.toBe(4900);
    await processAdgemPostback(store, rewardBody({ requestId: "req-100", conversionId: "conv-100", amountRaw: 100 }));
    expect(store.rewards()[1].amountCents).toBe(100);
  });

  it("3+4. payout_cents never determines the reward; revenue preserved on the row", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ amountRaw: 35, payoutCents: 150 }));
    const row = store.rewards()[0];
    expect(row.amountCents).toBe(35); // NOT 150
    expect(row.publisherRevenueCents).toBe(150);
  });

  it("5. identical retry produces no second ledger entry", async () => {
    const store = new MemoryAdgemStore();
    expect((await processAdgemPostback(store, rewardBody())).outcome).toBe("credited");
    const dup = await processAdgemPostback(store, rewardBody());
    expect(dup.outcome).toBe("duplicate");
    expect(store.rewards()).toHaveLength(1);
  });

  it("6. concurrent identical postbacks cannot double-credit", async () => {
    const store = new MemoryAdgemStore();
    const [a, b] = await Promise.all([
      processAdgemPostback(store, rewardBody()),
      processAdgemPostback(store, rewardBody()),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["credited", "duplicate"]);
    expect(store.rewards()).toHaveLength(1);
  });

  it("7. distinct conversion IDs for legitimate separate goals both credit", async () => {
    const store = new MemoryAdgemStore();
    const a = await processAdgemPostback(store, rewardBody({ requestId: "req-A", conversionId: "conv-A", goalId: "111" }));
    const b = await processAdgemPostback(store, rewardBody({ requestId: "req-B", conversionId: "conv-B", goalId: "222" }));
    expect(a.outcome).toBe("credited");
    expect(b.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(2);
  });

  it("8. same offer_id alone does not collapse legitimate conversions", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-o1", conversionId: "conv-o1" }));
    const second = await processAdgemPostback(store, rewardBody({ requestId: "req-o2", conversionId: "conv-o2" }));
    expect(second.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(2);
  });

  it("same conversion, different goal credits distinctly (no collapse)", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-g1", conversionId: "conv-X", goalId: "111", amountRaw: 100 }));
    const second = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-g2", conversionId: "conv-X", goalId: "222", amountRaw: 200 })
    );
    expect(second.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(2);
    expect(store.rewards().map((r) => r.amountCents).sort((x, y) => x - y)).toEqual([100, 200]);
  });

  it("crash between event insert and ledger insert still credits exactly once on retry", async () => {
    const store = new MemoryAdgemStore();
    // Simulate the crash: event row exists as 'received', no ledger row.
    await store.insertProviderEvent({
      provider: "adgem",
      externalEventId: "req-crash",
      userId: USER,
      externalOfferId: "9087",
      eventType: "reward",
      publisherRevenueCents: 150,
      userRewardCents: 0,
      rawPayload: { request_id: "req-crash", conversion_id: "conv-crash" },
      processingStatus: "received",
      error: null,
    });
    const res = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-crash", conversionId: "conv-crash", amountRaw: 70 })
    );
    expect(res.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    expect(store.rewards()[0].amountCents).toBe(70);
    // A further retry is a plain duplicate.
    expect((await processAdgemPostback(store, rewardBody({ requestId: "req-crash", conversionId: "conv-crash", amountRaw: 70 }))).outcome).toBe("duplicate");
    expect(store.rewards()).toHaveLength(1);
  });

  it("14. DB failure does not finalize; safe retry credits exactly once", async () => {
    const store = new MemoryAdgemStore();
    store.failLedgerInserts = 1;
    await expect(processAdgemPostback(store, rewardBody())).rejects.toThrow("transient db failure");
    expect(store.rewards()).toHaveLength(0);
    const retry = await processAdgemPostback(store, rewardBody());
    expect(retry.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    expect((await processAdgemPostback(store, rewardBody())).outcome).toBe("duplicate");
    expect(store.rewards()).toHaveLength(1);
  });

  it("request_id reuse across different conversions is rejected + flagged", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-dup" }));
    const res = await processAdgemPostback(store, rewardBody({ requestId: "req-dup", conversionId: "conv-OTHER" }));
    expect(res).toEqual({ outcome: "rejected", error: "request_id_mismatch" });
    expect(store.fraudFlags.some((f) => f.reason === "adgem_request_id_mismatch")).toBe(true);
    expect(store.rewards()).toHaveLength(1);
  });

  it("reward for a different user than the existing row is rejected", async () => {
    const store = new MemoryAdgemStore();
    store.profiles.add(OTHER_USER);
    await processAdgemPostback(store, rewardBody());
    const res = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-other", playerId: OTHER_USER })
    );
    // Same conversion+goal belongs to USER → mismatch, no second credit.
    expect(res).toEqual({ outcome: "rejected", error: "reward_user_mismatch" });
    expect(store.rewards()).toHaveLength(1);
  });

  it("11. unknown player cannot credit", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(store, rewardBody({ playerId: OTHER_USER }));
    expect(res).toEqual({ outcome: "rejected", error: "unknown_player" });
    expect(store.rewards()).toHaveLength(0);
  });

  it("13. unsupported conversion_type cannot credit", async () => {
    const store = new MemoryAdgemStore();
    for (const t of ["chargeback", "refund", "cancel", "bonus"]) {
      const res = await processAdgemPostback(store, rewardBody({ requestId: `req-${t}`, conversionType: t }));
      expect(res).toEqual({ outcome: "rejected", error: "unsupported_conversion_type" });
    }
    expect(store.rewards()).toHaveLength(0);
  });

  it("12. install event creates no monetary ledger row", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-install", conversionType: "install", amountRaw: 0 })
    );
    expect(res).toEqual({ outcome: "recorded" });
    expect(store.events.get("adgem:req-install")?.processingStatus).toBe("processed");
    expect(store.rewards()).toHaveLength(0);
  });

  it("9. invalid credit amounts cannot credit (defense in depth)", async () => {
    const store = new MemoryAdgemStore();
    for (const bad of [
      { ...rewardBody({ requestId: "r0" }), amountRaw: 0 },
      { ...rewardBody({ requestId: "rneg" }), amountRaw: -5 },
      { ...rewardBody({ requestId: "rfloat" }), amountRaw: 1.5 },
      { ...rewardBody({ requestId: "rhuge" }), amountRaw: 1_000_001 },
    ]) {
      const res = await processAdgemPostback(store, bad);
      expect(res).toEqual({ outcome: "rejected", error: "invalid_amount" });
    }
    expect(store.rewards()).toHaveLength(0);
  });
});
