import "server-only";

import {
  TIMEWALL_MAX_REWARD_CENTS,
  type NormalizedTimewallPostback,
} from "./shared";

export const TIMEWALL_PROVIDER_KEY = "timewall";

/**
 * Explicit allowlist of TimeWall `type` values proven to mean "credit the user".
 *
 * Shockingly important: NO `type` value is currently proven. TimeWall's public
 * site is Cloudflare-blocked, no public postback documentation is reachable,
 * and `type`/`withdrawid`/`reason` semantics (earn vs reversal/chargeback)
 * cannot be inferred. The set therefore ships EMPTY: every verified event is
 * stored durably as held, and NOTHING credits. To enable crediting after
 * TimeWall confirms the earn `type` value (dashboard docs or a live test
 * postback), add the exact string here — one line, plus a test.
 */
export const TIMEWALL_CREDITABLE_TYPES: ReadonlySet<string> = new Set<string>([]);

export interface TimewallProfile {
  id: string;
}

export interface TimewallStoredEvent {
  userId: string | null;
  processingStatus: string;
}

export interface TimewallRewardRow {
  id: string;
  userId: string;
  amountCents: number;
}

export interface TimewallLedgerInsert {
  userId: string;
  type: "offer_reward" | "reversal";
  status: "confirmed";
  amountCents: number;
  description: string;
  idempotencyKey: string;
  provider: string;
  providerTransactionId: string;
  publisherRevenueCents: number;
  metadata: Record<string, unknown>;
}

export interface TimewallEventInsert {
  provider: string;
  externalEventId: string;
  userId: string | null;
  externalOfferId: string | null;
  eventType: string;
  publisherRevenueCents: number;
  /** Credited value once credited, else 0. The credited value lives on the ledger row. */
  userRewardCents: number;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  error: string | null;
}

/**
 * Storage backend. Production = Supabase (lib/db/timewall-store.ts).
 * Uniqueness MUST be enforced at the database level (unique constraints),
 * so concurrent duplicate callbacks cannot double-credit.
 */
export interface TimewallStore {
  findProfile(userId: string): Promise<TimewallProfile | null>;
  /** Insert event; unique (provider, external_event_id). Returns inserted=false on conflict. */
  insertProviderEvent(row: TimewallEventInsert): Promise<{ inserted: boolean }>;
  findEventByTxid(txid: string): Promise<TimewallStoredEvent | null>;
  markEventProcessed(txid: string, processingStatus: string, error: string | null): Promise<void>;
  findRewardByTxid(txid: string): Promise<TimewallRewardRow | null>;
  /** Insert ledger row; unique idempotency_key. Returns inserted=false on conflict. */
  insertLedger(row: TimewallLedgerInsert): Promise<{ id: string; inserted: boolean }>;
  insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }): Promise<void>;
}

export type TimewallOutcome =
  | { outcome: "credited"; ledgerId: string }
  | { outcome: "duplicate"; detail: string }
  | { outcome: "held"; detail: string }
  | { outcome: "rejected"; error: string };

/**
 * Audit metadata only: identifiers useful for support/replay.
 * No IP (consistent with CPX/AdGem privacy posture), no hash, no secrets.
 */
function eventPayload(n: NormalizedTimewallPostback): Record<string, unknown> {
  return {
    userid: n.userid,
    txid: n.txid,
    revenue_raw: n.revenueRaw,
    revenue_cents: n.revenueCents,
    currency_cents: n.userRewardCents,
    type: n.type,
    withdrawid: n.withdrawid,
    reason: n.reason,
    offername: n.offername,
    offerdetail: n.offerdetail,
  };
}

function describeReward(n: NormalizedTimewallPostback): string {
  const offer = (n.offername || n.txid).slice(0, 60);
  return `Offer reward (TimeWall ${offer})`.slice(0, 140);
}

export interface ProcessTimewallOptions {
  /**
   * Test/confirmation hook for the credit allowlist. Production calls omit it
   * (empty set = HOLD). Tests inject synthetic values to exercise the credit
   * path WITHOUT asserting anything about real TimeWall `type` strings.
   */
  creditableTypes?: ReadonlySet<string>;
}

/**
 * Process one verified TimeWall postback. Idempotent: repeated identical
 * callbacks are acknowledged without creating additional ledger entries.
 *
 * Crash/race safety is LEDGER-ANCHORED, never event-anchored: a
 * provider_events row alone never proves a reward was credited. Every
 * duplicate verdict re-verifies the ledger row first, so a crash between
 * event insert and ledger insert can only resolve to a credit on retry,
 * never to a silent loss. DB unique constraints (idempotency_key and the
 * composite (provider, provider_transaction_id, type) index) close
 * concurrent races; no transaction primitive is required.
 */
export async function processTimewallPostback(
  store: TimewallStore,
  n: NormalizedTimewallPostback,
  opts: ProcessTimewallOptions = {}
): Promise<TimewallOutcome> {
  const creditable = opts.creditableTypes ?? TIMEWALL_CREDITABLE_TYPES;

  const profile = await store.findProfile(n.userid);
  if (!profile) {
    // Unknown user: record for audit, reward nothing.
    await store.insertProviderEvent({
      provider: TIMEWALL_PROVIDER_KEY,
      externalEventId: n.txid,
      userId: null,
      externalOfferId: n.offername,
      eventType: n.type,
      publisherRevenueCents: n.revenueCents,
      userRewardCents: 0,
      rawPayload: eventPayload(n),
      processingStatus: "rejected",
      error: "unknown_user",
    });
    return { outcome: "rejected", error: "unknown_user" };
  }

  // Defensive re-check (route shape already enforces this): only whole,
  // positive, in-range cents may become money. Never trust, never coerce.
  const amountOk =
    Number.isInteger(n.userRewardCents) &&
    n.userRewardCents > 0 &&
    n.userRewardCents <= TIMEWALL_MAX_REWARD_CENTS;
  if (!amountOk) {
    await store.insertProviderEvent({
      provider: TIMEWALL_PROVIDER_KEY,
      externalEventId: n.txid,
      userId: profile.id,
      externalOfferId: n.offername,
      eventType: n.type,
      publisherRevenueCents: n.revenueCents,
      userRewardCents: 0,
      rawPayload: eventPayload(n),
      processingStatus: "rejected",
      error: "invalid_amount",
    });
    return { outcome: "rejected", error: "invalid_amount" };
  }

  const { inserted: eventInserted } = await store.insertProviderEvent({
    provider: TIMEWALL_PROVIDER_KEY,
    externalEventId: n.txid,
    userId: profile.id,
    externalOfferId: n.offername,
    eventType: n.type,
    publisherRevenueCents: n.revenueCents,
    userRewardCents: 0,
    rawPayload: eventPayload(n),
    processingStatus: "received",
    error: null,
  });
  const duplicateEvent = !eventInserted;

  if (!creditable.has(n.type)) {
    // Verified event, unproven type semantics: store durably, credit nothing.
    // HTTP 200 acknowledges RECEIPT (stops provider retries); the explicit
    // `held_awaiting_type_confirmation` status (never `processed`) preserves
    // the truth for later replay once TimeWall confirms the earn type value.
    // A redelivered event row is left untouched — never overwrite a status
    // written by an earlier, possibly credited, attempt.
    if (eventInserted) {
      await store.markEventProcessed(n.txid, "held_awaiting_type_confirmation", null);
    }
    return { outcome: "held", detail: duplicateEvent ? "duplicate_event_held" : "unconfirmed_event_type" };
  }

  // ---- Credited path (only reachable with an explicitly allowlisted type) ----
  const existing = await store.findRewardByTxid(n.txid);
  if (existing) {
    // Same-user duplicate, or a conflicting reward row: never credit twice.
    // A conflicting row keeps its original audit status — only flag, never rewrite.
    if (existing.userId !== profile.id) {
      await store.insertFraudFlag({ userId: profile.id, reason: "timewall_txid_user_mismatch", severity: "high" });
      return { outcome: "rejected", error: "txid_user_mismatch" };
    }
    // Advance an incomplete event out of `received`, but never overwrite a
    // terminal status (`processed`, `held_*`, `rejected`) written earlier.
    const event = await store.findEventByTxid(n.txid);
    if (event && event.processingStatus === "received") {
      await store.markEventProcessed(n.txid, "duplicate_processed", null);
    }
    return { outcome: "duplicate", detail: duplicateEvent ? "duplicate_event" : "reward_exists" };
  }
  const { id, inserted } = await store.insertLedger({
    userId: profile.id,
    type: "offer_reward",
    status: "confirmed",
    // VERBATIM currency cents — no multiplier, no division (see shared.ts).
    amountCents: n.userRewardCents,
    description: describeReward(n),
    idempotencyKey: `timewall:${n.txid}:reward`,
    provider: TIMEWALL_PROVIDER_KEY,
    providerTransactionId: n.txid,
    publisherRevenueCents: n.revenueCents,
    metadata: eventPayload(n),
  });
  await store.markEventProcessed(n.txid, "processed", null);
  if (!inserted) return { outcome: "duplicate", detail: "reward_race" };
  return { outcome: "credited", ledgerId: id };
}
