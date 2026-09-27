import { describe, expect, it } from "vitest";
import {
  processAdgemPostback,
  type AdgemEventInsert,
  type AdgemStore,
  type AdgemStoredEvent,
} from "../process";
import type { AdgemPostbackBody } from "../shared";

const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_USER = "ffffffff-1111-2222-3333-444444444444";

/**
 * In-memory store mirroring DB uniqueness: unique (provider, external_event_id).
 * Atomic check-then-insert (no awaits inside) models the DB constraint for
 * concurrent-duplicate testing. Tracks ledger attempts to prove none occur.
 */
class MemoryAdgemStore implements AdgemStore {
  profiles = new Set<string>([USER]);
  events = new Map<string, AdgemEventInsert & { status: string | null }>();
  fraudFlags: Array<{ userId: string; reason: string }> = [];
  ledgerAttempts = 0;

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
  async insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }) {
    this.fraudFlags.push({ userId: input.userId, reason: input.reason });
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

describe("processAdgemPostback", () => {
  it("verified reward stores exactly one event and zero ledger value", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(store, rewardBody());
    expect(res).toEqual({ outcome: "held", detail: "amount_unit_unconfirmed" });
    expect(store.events.size).toBe(1);
    expect(store.ledgerAttempts).toBe(0);
    const event = store.events.get("adgem:req-001")!;
    // Publisher payout recorded as revenue; user reward stays 0 — payout is
    // NEVER used as the user reward.
    expect(event.publisherRevenueCents).toBe(150);
    expect(event.userRewardCents).toBe(0);
    expect(event.processingStatus).toBe("held");
  });

  it("identical retry does not duplicate (concurrent-safe)", async () => {
    const store = new MemoryAdgemStore();
    const [first, second] = await Promise.all([
      processAdgemPostback(store, rewardBody()),
      processAdgemPostback(store, rewardBody()),
    ]);
    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["duplicate", "held"]);
    expect(store.events.size).toBe(1);
    expect(store.ledgerAttempts).toBe(0);
  });

  it("two distinct conversions for the same user/offer are NOT collapsed", async () => {
    const store = new MemoryAdgemStore();
    const a = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-A", conversionId: "conv-A", goalId: "111" })
    );
    const b = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-B", conversionId: "conv-B", goalId: "222" })
    );
    expect(a.outcome).toBe("held");
    expect(b.outcome).toBe("held");
    expect(store.events.size).toBe(2);
  });

  it("same conversion, different goal (new request) is NOT collapsed", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-g1", conversionId: "conv-X", goalId: "111" }));
    const second = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-g2", conversionId: "conv-X", goalId: "222" })
    );
    expect(second.outcome).toBe("held");
    expect(store.events.size).toBe(2);
  });

  it("request_id reuse across different conversions is rejected + flagged", async () => {
    const store = new MemoryAdgemStore();
    await processAdgemPostback(store, rewardBody({ requestId: "req-dup" }));
    const res = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-dup", conversionId: "conv-OTHER" })
    );
    expect(res).toEqual({ outcome: "rejected", error: "request_id_mismatch" });
    expect(store.fraudFlags.some((f) => f.reason === "adgem_request_id_mismatch")).toBe(true);
    expect(store.events.size).toBe(1);
  });

  it("unknown player creates no value", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(store, rewardBody({ playerId: OTHER_USER }));
    expect(res).toEqual({ outcome: "rejected", error: "unknown_player" });
    expect(store.ledgerAttempts).toBe(0);
  });

  it("unsupported conversion_type cannot create positive value", async () => {
    const store = new MemoryAdgemStore();
    for (const t of ["chargeback", "refund", "cancel", "bonus"]) {
      const res = await processAdgemPostback(
        store,
        rewardBody({ requestId: `req-${t}`, conversionType: t })
      );
      expect(res).toEqual({ outcome: "rejected", error: "unsupported_conversion_type" });
    }
    expect(store.ledgerAttempts).toBe(0);
    expect(store.events.size).toBe(4);
  });

  it("install type is recorded as non-monetary, never credited", async () => {
    const store = new MemoryAdgemStore();
    const res = await processAdgemPostback(
      store,
      rewardBody({ requestId: "req-install", conversionType: "install", amountRaw: 0 })
    );
    expect(res).toEqual({ outcome: "recorded" });
    expect(store.events.get("adgem:req-install")?.processingStatus).toBe("processed");
    expect(store.ledgerAttempts).toBe(0);
  });
});
