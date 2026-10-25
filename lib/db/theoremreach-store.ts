import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/auth/server";
import { THEOREMREACH_PROVIDER_KEY, type TheoremreachStore } from "@/lib/providers/theoremreach/process";

const UNIQUE_VIOLATION = "23505";

export class SupabaseTheoremreachStore implements TheoremreachStore {
  constructor(private readonly db: SupabaseClient = getSupabaseAdmin()) {}

  async findProfile(userId: string) {
    const { data, error } = await this.db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error) throw new Error("TheoremReach profile lookup failed");
    return data ? { id: data.id as string } : null;
  }

  async insertProviderEvent(row: Parameters<TheoremreachStore["insertProviderEvent"]>[0]) {
    const { error } = await this.db.from("provider_events").insert({
      provider: THEOREMREACH_PROVIDER_KEY,
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
    if (error?.code === UNIQUE_VIOLATION) return { inserted: false };
    if (error) throw new Error("TheoremReach provider event insert failed");
    return { inserted: true };
  }

  async findProviderEvent(txId: string) {
    const { data, error } = await this.db
      .from("provider_events")
      .select("user_id,event_type,user_reward_cents,publisher_revenue_cents,processing_status")
      .eq("provider", THEOREMREACH_PROVIDER_KEY)
      .eq("external_event_id", txId)
      .maybeSingle();
    if (error) throw new Error("TheoremReach provider event lookup failed");
    if (!data) return null;
    return {
      userId: (data.user_id as string | null) ?? null,
      eventType: data.event_type as string,
      userRewardCents: data.user_reward_cents as number,
      publisherRevenueCents: data.publisher_revenue_cents as number,
      processingStatus: data.processing_status as string,
    };
  }

  async markEventProcessed(txId: string, processingStatus: string, error: string | null) {
    const { error: updateError } = await this.db
      .from("provider_events")
      .update({ processing_status: processingStatus, error, processed_at: new Date().toISOString() })
      .eq("provider", THEOREMREACH_PROVIDER_KEY)
      .eq("external_event_id", txId);
    if (updateError) throw new Error("TheoremReach provider event update failed");
  }

  async findRewardByTxId(txId: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("id,user_id,amount_cents,publisher_revenue_cents,status")
      .eq("provider", THEOREMREACH_PROVIDER_KEY)
      .eq("provider_transaction_id", txId)
      .eq("type", "survey_reward")
      .maybeSingle();
    if (error) throw new Error("TheoremReach reward lookup failed");
    if (!data) return null;
    return {
      id: data.id as string,
      userId: data.user_id as string,
      amountCents: data.amount_cents as number,
      publisherRevenueCents: data.publisher_revenue_cents as number,
      status: data.status as string,
    };
  }

  async hasReversalForTxId(txId: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("id")
      .eq("provider", THEOREMREACH_PROVIDER_KEY)
      .eq("provider_transaction_id", txId)
      .eq("type", "reversal")
      .limit(1);
    if (error) throw new Error("TheoremReach reversal lookup failed");
    return (data?.length ?? 0) > 0;
  }

  async insertLedger(row: any) {
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
    if (error?.code === UNIQUE_VIOLATION) return { id: "", inserted: false };
    if (error) throw new Error("TheoremReach ledger insert failed");
    return { id: data.id as string, inserted: true };
  }

  async insertFraudFlag(input: { userId: string; reason: string; severity: "low" | "medium" | "high" }) {
    const { error } = await this.db.from("fraud_flags").insert({
      user_id: input.userId,
      reason: input.reason,
      severity: input.severity,
    });
    if (error) throw new Error("TheoremReach fraud flag insert failed");
  }
}
