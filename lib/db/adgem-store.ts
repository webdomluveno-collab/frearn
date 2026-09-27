import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/auth/server";
import {
  ADGEM_PROVIDER_KEY,
  type AdgemEventInsert,
  type AdgemLedgerInsert,
  type AdgemStore,
} from "@/lib/providers/adgem/process";

/** Postgres unique-violation code. Uniqueness is enforced by the DB, not by app checks. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

/**
 * Supabase backend for AdGem postbacks. Uses the generic provider_events table
 * (unique (provider, external_event_id)) — no migration, no new tables.
 * Writes ledger rows NEVER (see process.ts): this class has no ledger access.
 */
export class SupabaseAdgemStore implements AdgemStore {
  constructor(private readonly db: SupabaseClient = getSupabaseAdmin()) {}

  async findProfile(userId: string) {
    const { data, error } = await this.db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error || !data) return null;
    return { id: data.id as string };
  }

  async insertProviderEvent(row: AdgemEventInsert) {
    const { error } = await this.db.from("provider_events").insert({
      provider: row.provider,
      external_event_id: row.externalEventId,
      user_id: row.userId,
      external_offer_id: row.externalOfferId,
      event_type: row.eventType,
      publisher_revenue_cents: row.publisherRevenueCents,
      user_reward_cents: row.userRewardCents,
      raw_payload: row.rawPayload,
      processing_status: row.processingStatus,
      error: row.error,
    });
    if (error) {
      if (isUniqueViolation(error)) return { inserted: false };
      throw new Error(`provider_events insert failed: ${error.message}`);
    }
    return { inserted: true };
  }

  async findEventByRequestId(requestId: string) {
    const { data, error } = await this.db
      .from("provider_events")
      .select("user_id,raw_payload")
      .eq("provider", ADGEM_PROVIDER_KEY)
      .eq("external_event_id", requestId)
      .maybeSingle();
    if (error) throw new Error(`event lookup failed: ${error.message}`);
    if (!data) return null;
    const raw = (data.raw_payload ?? {}) as Record<string, unknown>;
    return {
      userId: (data.user_id as string | null) ?? null,
      conversionId: typeof raw.conversion_id === "string" ? raw.conversion_id : "",
    };
  }

  async findRewardByTxnRef(txnRef: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("id,user_id,amount_cents")
      .eq("provider", ADGEM_PROVIDER_KEY)
      .eq("provider_transaction_id", txnRef)
      .eq("type", "offer_reward")
      .maybeSingle();
    if (error) throw new Error(`reward lookup failed: ${error.message}`);
    if (!data) return null;
    return { id: data.id as string, userId: data.user_id as string, amountCents: data.amount_cents as number };
  }

  async insertLedgerReward(row: AdgemLedgerInsert) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .insert({
        user_id: row.userId,
        type: row.type,
        status: row.status,
        amount_cents: row.amountCents,
        description: row.description,
        idempotency_key: row.idempotencyKey,
        provider: row.provider,
        provider_transaction_id: row.providerTransactionId,
        publisher_revenue_cents: row.publisherRevenueCents,
        metadata: row.metadata,
      })
      .select("id")
      .single();
    if (error) {
      if (isUniqueViolation(error)) return { id: "", inserted: false };
      throw new Error(`ledger insert failed: ${error.message}`);
    }
    return { id: data.id as string, inserted: true };
  }

  async markEventProcessed(requestId: string, processingStatus: string, error: string | null) {
    const { error: updateError } = await this.db
      .from("provider_events")
      .update({ processing_status: processingStatus, error, processed_at: new Date().toISOString() })
      .eq("provider", ADGEM_PROVIDER_KEY)
      .eq("external_event_id", requestId);
    if (updateError) throw new Error(`provider_events update failed: ${updateError.message}`);
  }

  async insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }) {
    const { error } = await this.db.from("fraud_flags").insert({
      user_id: input.userId,
      reason: input.reason,
      severity: input.severity,
    });
    if (error) throw new Error(`fraud flag insert failed: ${error.message}`);
  }
}
