import { describe, expect, it } from "vitest";
import {
  processCpxPostback,
  type CpxEventInsert,
  type CpxLedgerInsert,
  type CpxStore,
} from "../process";
import { normalizePostback, validatePostbackShape, type CpxPostbackParams } from "../shared";

const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER = "ffffffff-1111-2222-3333-444444444444";

/** In-memory store mirroring DB uniqueness exactly (migration 004):
 * unique event key + unique idempotency key + unique (provider, txn, type).
 * The two-column variant (without type) is what silently blocked reversals
 * in production — this double must stay as strict as the real schema. */
class MemoryStore implements CpxStore {
  profiles = new Set<string>([USER]);
  events = new Map<string, CpxEventInsert & { processed: { status: string; error: string | null } | null }>();
  ledger: Array<CpxLedgerInsert & { id: string }> = [];
  fraudFlags: Array<{ userId: string; reason: string }> = [];
  private seq = 0;
  private compositeKeys = new Set<string>();

  async findProfile(userId: string) {
    return this.profiles.has(userId) ? { id: userId } : null;
  }
  async insertProviderEvent(row: CpxEventInsert) {
    const key = `${row.provider}:${row.externalEventId}`;
    if (this.events.has(key)) return { inserted: false };
    this.events.set(key, { ...row, processed: null });
    return { inserted: true };
  }
  async markEventProcessed(transId: string, processingStatus: string, error: string | null) {
    const e = this.events.get(`cpx:${transId}`);
    if (e) {
      e.processingStatus = processingStatus;
      e.error = error;
      e.processed = { status: processingStatus, error };
    }
  }
  async findRewardByTransId(transId: string) {
    const r = this.ledger.find(
      (l) => l.provider === "cpx" && l.providerTransactionId === transId && l.type === "survey_reward"
    );
    return r ? { id: r.id, userId: r.userId, amountCents: r.amountCents, status: r.status } : null;
  }
  async insertLedger(row: CpxLedgerInsert) {
    if (this.ledger.some((l) => l.idempotencyKey === row.idempotencyKey)) return { id: "", inserted: false };
    // Mirror of ledger_transactions_provider_txn_uidx (migration 004):
    // (provider, provider_transaction_id, type) must be unique when txn id present.
    const composite = row.providerTransactionId ? `${row.provider}|${row.providerTransactionId}|${row.type}` : null;
    if (composite && this.compositeKeys.has(composite)) return { id: "", inserted: false };
    const id = `ledger-${++this.seq}`;
    this.ledger.push({ ...row, id });
    if (composite) this.compositeKeys.add(composite);
    return { id, inserted: true };
  }
  async hasReversalForTransId(transId: string) {
    return this.ledger.some((l) => l.provider === "cpx" && l.providerTransactionId === transId && l.type === "reversal");
  }
  async getConfirmedSumCents(userId: string) {
    return this.ledger.filter((l) => l.userId === userId && l.status === "confirmed").reduce((s, l) => s + l.amountCents, 0);
  }
  async insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }) {
    this.fraudFlags.push({ userId: input.userId, reason: input.reason });
  }
}

function params(overrides: Partial<CpxPostbackParams> = {}): CpxPostbackParams {
  return {
    status: "1",
    transId: "txn-001",
    extUserId: USER,
    amountLocal: "1.40",
    amountUsd: "2.00",
    offerId: "offer-9",
    hash: "a".repeat(32), // shape-valid placeholder; authenticity is tested in hash.test.ts
    ...overrides,
  };
}

describe("processCpxPostback", () => {
  it("1. valid completion creates exactly one reward with integer cents", async () => {
    const store = new MemoryStore();
    const p = params();
    expect(validatePostbackShape(p)).toEqual({ ok: true });
    const res = await processCpxPostback(store, normalizePostback(p));
    expect(res.outcome).toBe("rewarded");
    expect(store.ledger).toHaveLength(1);
    const row = store.ledger[0];
    expect(row.type).toBe("survey_reward");
    expect(row.amountCents).toBe(140); // "1.40" → 140, no floats
    expect(row.publisherRevenueCents).toBe(200); // "2.00" → 200
    expect(Number.isInteger(row.amountCents)).toBe(true);
    expect(row.status).toBe("confirmed");
    expect(await store.getConfirmedSumCents(USER)).toBe(140);
  });

  it("2. duplicate completion creates no second reward", async () => {
    const store = new MemoryStore();
    const n = normalizePostback(params());
    expect((await processCpxPostback(store, n)).outcome).toBe("rewarded");
    const again = await processCpxPostback(store, n);
    expect(again.outcome).toBe("duplicate");
    const third = await processCpxPostback(store, n);
    expect(third.outcome).toBe("duplicate");
    expect(store.ledger.filter((l) => l.type === "survey_reward")).toHaveLength(1);
    expect(await store.getConfirmedSumCents(USER)).toBe(140);
  });

  it("4. nonexistent user creates no reward (rejected + audited)", async () => {
    const store = new MemoryStore();
    const res = await processCpxPostback(store, normalizePostback(params({ extUserId: OTHER_USER })));
    // OTHER_USER is not in profiles
    expect(res).toEqual({ outcome: "rejected", error: "unknown_user" });
    expect(store.ledger).toHaveLength(0);
  });

  it("5. malformed amounts are rejected by shape validation", async () => {
    for (const bad of ["1.1234567", "-2", "abc", "", "1,40", "99999999.99"]) {
      expect(validatePostbackShape(params({ amountLocal: bad })).ok).toBe(false);
    }
    expect(validatePostbackShape(params({ amountUsd: "NaN" })).ok).toBe(false);
    expect(validatePostbackShape(params({ status: "3" })).ok).toBe(false);
    expect(validatePostbackShape(params({ transId: "" })).ok).toBe(false);
    expect(validatePostbackShape(params({ extUserId: "not-a-uuid" })).ok).toBe(false);
    expect(validatePostbackShape(params({ amountLocal: "0.00" })).ok).toBe(false); // completion with zero reward
  });

  it("6. status=2 creates one reversal linked to the original", async () => {
    const store = new MemoryStore();
    const done = await processCpxPostback(store, normalizePostback(params()));
    expect(done.outcome).toBe("rewarded");
    const originalId = (done as { ledgerId: string }).ledgerId;

    const rev = await processCpxPostback(store, normalizePostback(params({ status: "2" })));
    expect(rev.outcome).toBe("reversed");
    expect(store.ledger).toHaveLength(2);
    const reversal = store.ledger[1];
    expect(reversal.type).toBe("reversal");
    expect(reversal.amountCents).toBe(-140);
    expect(reversal.metadata.reverses_ledger_id).toBe(originalId);
    expect(await store.getConfirmedSumCents(USER)).toBe(0);
    // Original row untouched (immutable history).
    expect(store.ledger[0].amountCents).toBe(140);
  });

  it("7. duplicate status=2 creates no second reversal", async () => {
    const store = new MemoryStore();
    await processCpxPostback(store, normalizePostback(params()));
    expect((await processCpxPostback(store, normalizePostback(params({ status: "2" })))).outcome).toBe("reversed");
    const dup = await processCpxPostback(store, normalizePostback(params({ status: "2" })));
    expect(dup.outcome).toBe("duplicate");
    expect(store.ledger.filter((l) => l.type === "reversal")).toHaveLength(1);
    expect(await store.getConfirmedSumCents(USER)).toBe(0);
  });

  it("8. reversal references the correct original transaction", async () => {
    const store = new MemoryStore();
    await processCpxPostback(store, normalizePostback(params({ transId: "txn-A", amountLocal: "1.00" })));
    await processCpxPostback(store, normalizePostback(params({ transId: "txn-B", amountLocal: "3.00" })));
    await processCpxPostback(store, normalizePostback(params({ status: "2", transId: "txn-B" })));
    const reversal = store.ledger.find((l) => l.type === "reversal");
    const originalB = store.ledger.find((l) => l.providerTransactionId === "txn-B" && l.type === "survey_reward");
    expect(reversal?.metadata.reverses_ledger_id).toBe(originalB?.id);
    expect(reversal?.amountCents).toBe(-300);
    expect(await store.getConfirmedSumCents(USER)).toBe(100);
  });

  it("reversal without an original is an audited orphan (no deduction)", async () => {
    const store = new MemoryStore();
    const res = await processCpxPostback(store, normalizePostback(params({ status: "2" })));
    expect(res.outcome).toBe("orphan_reversal");
    expect(store.ledger).toHaveLength(0);
    expect(store.fraudFlags.some((f) => f.reason === "cpx_orphan_reversal")).toBe(true);
  });

  it("reversal below zero preserves the owed state and flags for review", async () => {
    const store = new MemoryStore();
    await processCpxPostback(store, normalizePostback(params({ amountLocal: "1.00" })));
    // Simulate a withdrawn balance: external withdrawal of the full amount.
    store.ledger.push({
      id: "ledger-w", userId: USER, type: "survey_reward", status: "confirmed",
      amountCents: -100, description: "withdrawal", idempotencyKey: "w",
      provider: null as unknown as string, providerTransactionId: "", publisherRevenueCents: 0, metadata: {},
    });
    const rev = await processCpxPostback(store, normalizePostback(params({ status: "2" })));
    expect(rev.outcome).toBe("reversed");
    expect(await store.getConfirmedSumCents(USER)).toBe(-100); // owed state preserved, not clamped
    expect(store.fraudFlags.some((f) => f.reason === "negative_balance_after_reversal")).toBe(true);
  });

  it("same trans_id for a different user is rejected (no cross-credit)", async () => {
    const store = new MemoryStore();
    store.profiles.add(OTHER_USER);
    await processCpxPostback(store, normalizePostback(params()));
    const res = await processCpxPostback(store, normalizePostback(params({ extUserId: OTHER_USER })));
    expect(res).toEqual({ outcome: "rejected", error: "trans_id_user_mismatch" });
    expect(store.ledger.filter((l) => l.type === "survey_reward")).toHaveLength(1);
  });

  it("production reversal incident: status1 +70, status2 −70, duplicates inert, net zero", async () => {
    // Mirrors trans_id 1001219086228: amount_local=0.7000 → 70¢, amount_usd=1.00 → 100¢.
    const store = new MemoryStore();
    const X = "1001219086228";
    const base = { transId: X, amountLocal: "0.7000", amountUsd: "1.00", offerId: "1" };

    const r1 = await processCpxPostback(store, normalizePostback(params({ ...base, status: "1" })));
    expect(r1.outcome).toBe("rewarded");
    expect(await store.getConfirmedSumCents(USER)).toBe(70);

    const r2 = await processCpxPostback(store, normalizePostback(params({ ...base, status: "2" })));
    expect(r2.outcome).toBe("reversed");
    expect(await store.getConfirmedSumCents(USER)).toBe(0);

    const d1 = await processCpxPostback(store, normalizePostback(params({ ...base, status: "1" })));
    expect(d1.outcome).toBe("duplicate");
    const d2 = await processCpxPostback(store, normalizePostback(params({ ...base, status: "2" })));
    expect(d2.outcome).toBe("duplicate");

    // Exactly two rows, net effect zero for X.
    expect(store.ledger).toHaveLength(2);
    expect(store.ledger[0]).toMatchObject({ type: "survey_reward", amountCents: 70, publisherRevenueCents: 100 });
    expect(store.ledger[1]).toMatchObject({ type: "reversal", amountCents: -70 });
    expect(store.ledger[1].metadata.reverses_ledger_id).toBe(store.ledger[0].id);
    expect(await store.getConfirmedSumCents(USER)).toBe(0);
  });
});
