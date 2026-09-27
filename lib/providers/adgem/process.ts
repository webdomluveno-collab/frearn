import "server-only";

import type { AdgemPostbackBody } from "./shared";

export const ADGEM_PROVIDER_KEY = "adgem";

/**
 * AdGem Server Postback v3 processor.
 *
 * DELIBERATE NON-CREDITING DESIGN (see shared.ts + README):
 * AdGem's `data.amount` is denominated in the publisher's VIRTUAL CURRENCY,
 * and no publisher-confirmed coin→cent rate exists. This processor therefore
 * verifies, validates, and durably stores every legitimate event but NEVER
 * writes a ledger row. Verified reward events are stored with
 * processing_status 'held' so a future, explicitly-configured mapping can
 * replay them — no value is lost and none is invented.
 */

export interface AdgemStoredEvent {
  userId: string | null;
  conversionId: string;
}

export interface AdgemEventInsert {
  provider: string;
  externalEventId: string;
  userId: string | null;
  externalOfferId: string | null;
  eventType: string;
  publisherRevenueCents: number;
  /** Always 0 for AdGem: nothing is ever credited (see above). */
  userRewardCents: number;
  rawPayload: Record<string, unknown>;
  processingStatus: string;
  error: string | null;
}

export interface AdgemStore {
  findProfile(userId: string): Promise<{ id: string } | null>;
  /** Insert event; unique (provider, external_event_id). Returns inserted=false on conflict. */
  insertProviderEvent(row: AdgemEventInsert): Promise<{ inserted: boolean }>;
  findEventByRequestId(requestId: string): Promise<AdgemStoredEvent | null>;
  markEventProcessed(requestId: string, processingStatus: string, error: string | null): Promise<void>;
  insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }): Promise<void>;
}

export type AdgemOutcome =
  | { outcome: "held"; detail: string }
  | { outcome: "recorded" }
  | { outcome: "duplicate"; detail: string }
  | { outcome: "rejected"; error: "unknown_player" | "unsupported_conversion_type" | "request_id_mismatch" };

/** Audit metadata only: identifiers useful for support/replay. No PII (no GAID/IDFA/IP/UA), no secrets. */
function eventPayload(b: AdgemPostbackBody): Record<string, unknown> {
  return {
    request_id: b.requestId,
    conversion_id: b.conversionId,
    offer_id: b.offerId,
    goal_id: b.goalId,
    goal_name: b.goalName,
    offer_name: b.offerName,
    campaign_id: b.campaignId,
    conversion_type: b.conversionType,
    amount_raw: b.amountRaw,
    amount_unit: "adgem_virtual_currency_UNMAPPED",
    payout_cents: b.payoutCents,
    all_goals_completed: b.allGoalsCompleted,
    credit: "held",
    credit_hold_reason: "no publisher-confirmed virtual-currency to USD-cent rate",
  };
}

export async function processAdgemPostback(store: AdgemStore, b: AdgemPostbackBody): Promise<AdgemOutcome> {
  const profile = await store.findProfile(b.playerId);
  if (!profile) {
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: null,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "rejected",
      error: "unknown_player",
    });
    return { outcome: "rejected", error: "unknown_player" };
  }

  if (b.conversionType !== "reward" && b.conversionType !== "install") {
    await store.insertProviderEvent({
      provider: ADGEM_PROVIDER_KEY,
      externalEventId: b.requestId,
      userId: profile.id,
      externalOfferId: b.offerId,
      eventType: b.conversionType,
      publisherRevenueCents: b.payoutCents,
      userRewardCents: 0,
      rawPayload: eventPayload(b),
      processingStatus: "rejected",
      error: "unsupported_conversion_type",
    });
    return { outcome: "rejected", error: "unsupported_conversion_type" };
  }

  const { inserted: eventInserted } = await store.insertProviderEvent({
    provider: ADGEM_PROVIDER_KEY,
    externalEventId: b.requestId,
    userId: profile.id,
    externalOfferId: b.offerId,
    eventType: b.conversionType,
    publisherRevenueCents: b.payoutCents,
    userRewardCents: 0,
    rawPayload: eventPayload(b),
    processingStatus: "received",
    error: null,
  });

  if (!eventInserted) {
    // Same request_id seen before: only a true redelivery is safe to acknowledge.
    const existing = await store.findEventByRequestId(b.requestId);
    if (!existing || existing.conversionId !== b.conversionId || existing.userId !== profile.id) {
      await store.insertFraudFlag({ userId: profile.id, reason: "adgem_request_id_mismatch", severity: "high" });
      await store.markEventProcessed(b.requestId, "rejected", "request_id_mismatch");
      return { outcome: "rejected", error: "request_id_mismatch" };
    }
    await store.markEventProcessed(b.requestId, "duplicate_processed", null);
    return { outcome: "duplicate", detail: "request_id_seen" };
  }

  if (b.conversionType === "install") {
    // Documented non-monetary tracking event: record, never credit.
    await store.markEventProcessed(b.requestId, "processed", null);
    return { outcome: "recorded" };
  }

  // Verified "reward": stored durably, credit explicitly withheld (see above).
  await store.markEventProcessed(b.requestId, "held", null);
  return { outcome: "held", detail: "amount_unit_unconfirmed" };
}
