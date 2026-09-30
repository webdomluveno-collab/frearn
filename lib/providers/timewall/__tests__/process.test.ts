import { describe, expect, it } from "vitest";
import {
  processTimewallPostback,
  type TimewallEventInsert,
  type TimewallLedgerInsert,
  type TimewallStore,
} from "../process";
import { normalizePostback, type TimewallPostbackParams } from "../shared";

const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER = "ffffffff-1111-2222-3333-444444444444";
// Synthetic type used ONLY to exercise the credit path in tests. It asserts
// nothing about real TimeWall `type` strings (which remain unconfirmed).
const TEST_EARN_TYPE = "test_earn";

function params(overrides: Partial<TimewallPostbackParams> = {}): TimewallPostbackParams {
  return {
    userid: USER,
    txid: "tw-001",
    revenueRaw: "1.00",
    currencyRaw: "70",
    hash: "a".repeat(64),
    type: "test_earn",
    ...overrides,
  };
}

function normalized(overrides: Partial<TimewallPostbackParams> = {}) {
  const p = params(overrides);
  const n = normalizePostback(p);
  return n;
}

/**
 * In-memory store mirroring production DB uniqueness exactly:
 * - unique (provider, external_event_id) on events,
 * - unique idempotency_key AND unique (provider, txn, type) on ledger rows.
 * Atomic check-then-insert (no awaits inside) models the DB constraint for
 * concurrent-duplicate testing.
 */
class MemoryTimewallStore implements TimewallStore {
  profiles = new Set<string>([USER]);
  events = new Map<string, TimewallEventInsert & { status: string | null }>();
  ledger: Array<TimewallLedgerInsert & { id: string }> = [];
  fraudFlags: Array<{ userId: string; reason: string }> = [];
  failLedgerInserts = 0;
  failEventInserts = 0;
  private seq = 0;
  private compositeKeys = new Set<string>();

  async findProfile(userId: string) {
    return this.profiles.has(userId) ? { id: userId } : null;
  }
  async insertProviderEvent(row: TimewallEventInsert) {
    if (this.failEventInserts > 0) {
      this.failEventInserts -= 1;
      throw new Error("transient db failure");
    }
    const key = `${row.provider}:${row.externalEventId}`;
    if (this.events.has(key)) return { inserted: false };
    this.events.set(key, { ...row, status: null });
    return { inserted: true };
  }
  async findEventByTxid(txid: string) {
    const e = this.events.get(`timewall:${txid}`);
    if (!e) return null;
    return { userId: e.userId, processingStatus: e.processingStatus };
  }
  async markEventProcessed(txid: string, processingStatus: string, error: string | null) {
    const e = this.events.get(`timewall:${txid}`);
    if (e) {
      e.processingStatus = processingStatus;
      e.error = error;
      e.status = processingStatus;
    }
  }
  async findRewardByTxid(txid: string) {
    const r = this.ledger.find(
      (l) => l.provider === "timewall" && l.providerTransactionId === txid && l.type === "offer_reward"
    );
    return r ? { id: r.id, userId: r.userId, amountCents: r.amountCents } : null;
  }
  async insertLedger(row: TimewallLedgerInsert) {
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

const ALLOW = { creditableTypes: new Set<string>([TEST_EARN_TYPE]) };

describe("processTimewallPostback — HOLD default (production behavior)", () => {
  it("verified event with unconfirmed type is held: stored, never credited", async () => {
    const store = new MemoryTimewallStore();
    const res = await processTimewallPostback(store, normalized({ type: "some_unknown_type" }));
    expect(res).toEqual({ outcome: "held", detail: "unconfirmed_event_type" });
    expect(store.rewards()).toHaveLength(0);
    const event = store.events.get("timewall:tw-001")!;
    expect(event.processingStatus).toBe("held_awaiting_type_confirmation");
    expect(event.userRewardCents).toBe(0);
  });

  it("held redelivery does not duplicate anything and keeps the held status", async () => {
    const store = new MemoryTimewallStore();
    await processTimewallPostback(store, normalized({ type: "mystery" }));
    const again = await processTimewallPostback(store, normalized({ type: "mystery" }));
    expect(again.outcome).toBe("held");
    expect(store.rewards()).toHaveLength(0);
    expect(store.events.get("timewall:tw-001")!.processingStatus).toBe("held_awaiting_type_confirmation");
  });
});

describe("processTimewallPostback — credit path (injected allowlist, tests only)", () => {
  it("valid reward credits exactly one confirmed +70¢ offer_reward (NOT 49¢)", async () => {
    const store = new MemoryTimewallStore();
    const res = await processTimewallPostback(
      store,
      normalized({ type: TEST_EARN_TYPE, revenueRaw: "1.00", currencyRaw: "70" }),
      ALLOW
    );
    expect(res.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    const row = store.rewards()[0];
    expect(row.type).toBe("offer_reward");
    expect(row.status).toBe("confirmed");
    expect(row.provider).toBe("timewall");
    expect(row.amountCents).toBe(70); // verbatim — no second 70% multiplier
    expect(row.publisherRevenueCents).toBe(100); // revenue kept separate
    expect(row.providerTransactionId).toBe("tw-001");
    expect(row.idempotencyKey).toBe("timewall:tw-001:reward");
    expect(row.description).toContain("TimeWall");
    const event = store.events.get("timewall:tw-001")!;
    expect(event.processingStatus).toBe("processed");
  });

  it("dashboard example holds exactly: $0.10 revenue -> 7 cents", async () => {
    const store = new MemoryTimewallStore();
    await processTimewallPostback(
      store,
      normalized({ type: TEST_EARN_TYPE, txid: "tw-007", revenueRaw: "0.10", currencyRaw: "7" }),
      ALLOW
    );
    const row = store.rewards()[0];
    expect(row.amountCents).toBe(7);
    expect(row.publisherRevenueCents).toBe(10);
  });

  it("identical retry produces no second ledger entry", async () => {
    const store = new MemoryTimewallStore();
    const n = normalized({ type: TEST_EARN_TYPE });
    expect((await processTimewallPostback(store, n, ALLOW)).outcome).toBe("credited");
    const dup = await processTimewallPostback(store, n, ALLOW);
    expect(dup.outcome).toBe("duplicate");
    expect(store.rewards()).toHaveLength(1);
  });

  it("concurrent identical postbacks cannot double-credit", async () => {
    const store = new MemoryTimewallStore();
    const n = normalized({ type: TEST_EARN_TYPE });
    const [a, b] = await Promise.all([
      processTimewallPostback(store, n, ALLOW),
      processTimewallPostback(store, n, ALLOW),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["credited", "duplicate"]);
    expect(store.rewards()).toHaveLength(1);
  });

  it("crash between event insert and ledger insert still credits exactly once on retry", async () => {
    const store = new MemoryTimewallStore();
    // Simulate the crash: event row exists as 'received', no ledger row.
    await store.insertProviderEvent({
      provider: "timewall",
      externalEventId: "tw-crash",
      userId: USER,
      externalOfferId: null,
      eventType: TEST_EARN_TYPE,
      publisherRevenueCents: 100,
      userRewardCents: 0,
      rawPayload: {},
      processingStatus: "received",
      error: null,
    });
    const res = await processTimewallPostback(
      store,
      normalized({ type: TEST_EARN_TYPE, txid: "tw-crash", revenueRaw: "1.00", currencyRaw: "70" }),
      ALLOW
    );
    expect(res.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    expect((await processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE, txid: "tw-crash" }), ALLOW)).outcome).toBe(
      "duplicate"
    );
    expect(store.rewards()).toHaveLength(1);
  });

  it("DB failure does not finalize; safe retry credits exactly once", async () => {
    const store = new MemoryTimewallStore();
    store.failLedgerInserts = 1;
    await expect(processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE }), ALLOW)).rejects.toThrow(
      "transient db failure"
    );
    expect(store.rewards()).toHaveLength(0);
    const retry = await processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE }), ALLOW);
    expect(retry.outcome).toBe("credited");
    expect(store.rewards()).toHaveLength(1);
    expect((await processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE }), ALLOW)).outcome).toBe(
      "duplicate"
    );
    expect(store.rewards()).toHaveLength(1);
  });

  it("same txid with conflicting user is rejected + flagged, no second ledger", async () => {
    const store = new MemoryTimewallStore();
    store.profiles.add(OTHER_USER);
    await processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE }), ALLOW);
    const res = await processTimewallPostback(
      store,
      normalized({ type: TEST_EARN_TYPE, userid: OTHER_USER }),
      ALLOW
    );
    expect(res).toEqual({ outcome: "rejected", error: "txid_user_mismatch" });
    expect(store.fraudFlags.some((f) => f.reason === "timewall_txid_user_mismatch")).toBe(true);
    expect(store.rewards()).toHaveLength(1);
  });

  it("unknown user creates no value", async () => {
    const store = new MemoryTimewallStore();
    const res = await processTimewallPostback(store, normalized({ type: TEST_EARN_TYPE, userid: OTHER_USER }), ALLOW);
    expect(res).toEqual({ outcome: "rejected", error: "unknown_user" });
    expect(store.rewards()).toHaveLength(0);
  });

  it("invalid amounts cannot credit even on the allowlisted path", async () => {
    const store = new MemoryTimewallStore();
    // NOTE: the route rejects these at shape validation (400) before process
    // ever runs; this proves the process-level defensive re-check independently.
    for (const [txid, currencyRaw] of [
      ["r0", "0"],
      ["rneg", "-5"],
      ["rhuge", "1000001"],
    ] as Array<[string, string]>) {
      const n = normalizePostback(params({ type: TEST_EARN_TYPE, txid, currencyRaw }));
      const res = await processTimewallPostback(store, n, ALLOW);
      expect(res).toEqual({ outcome: "rejected", error: "invalid_amount" });
    }
    expect(store.rewards()).toHaveLength(0);
  });
});
