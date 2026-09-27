import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/auth/server";
import { CPX_PROVIDER_KEY, type CpxEventInsert, type CpxLedgerInsert, type CpxStore } from "@/lib/providers/cpx/process";

/** Postgres unique-violation code. Uniqueness is enforced by the DB, not by app checks. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

export class SupabaseCpxStore implements CpxStore {
  constructor(private readonly db: SupabaseClient = getSupabaseAdmin()) {}

  async findProfile(userId: string) {
    const { data, error } = await this.db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (error || !data) return null;
    return { id: data.id as string };
  }

  async insertProviderEvent(row: CpxEventInsert) {
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

  async markEventProcessed(transId: string, processingStatus: string, error: string | null) {
    const { error: updateError } = await this.db
      .from("provider_events")
      .update({ processing_status: processingStatus, error, processed_at: new Date().toISOString() })
      .eq("provider", CPX_PROVIDER_KEY)
      .eq("external_event_id", transId);
    if (updateError) throw new Error(`provider_events update failed: ${updateError.message}`);
  }

  async findRewardByTransId(transId: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("id,user_id,amount_cents,status")
      .eq("provider", CPX_PROVIDER_KEY)
      .eq("provider_transaction_id", transId)
      .eq("type", "survey_reward")
      .maybeSingle();
    if (error) throw new Error(`reward lookup failed: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id as string,
      userId: data.user_id as string,
      amountCents: data.amount_cents as number,
      status: data.status as string,
    };
  }

  async insertLedger(row: CpxLedgerInsert) {
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

  async hasReversalForTransId(transId: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("id")
      .eq("provider", CPX_PROVIDER_KEY)
      .eq("provider_transaction_id", transId)
      .eq("type", "reversal")
      .limit(1);
    if (error) throw new Error(`reversal lookup failed: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  async getConfirmedSumCents(userId: string) {
    const { data, error } = await this.db
      .from("ledger_transactions")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("status", "confirmed");
    if (error) throw new Error(`balance sum failed: ${error.message}`);
    return (data ?? []).reduce((sum: number, r: { amount_cents: number }) => sum + r.amount_cents, 0);
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

/** Read-only wallet queries for the signed-in user's own data. */
export async function getUserLedger(userId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("ledger_transactions")
    .select("id,user_id,type,status,amount_cents,description,idempotency_key,created_at,provider,provider_transaction_id,publisher_revenue_cents,metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`ledger read failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as "survey_reward" | "offer_reward" | "adjustment" | "withdrawal" | "reversal",
    status: r.status as "pending" | "confirmed" | "reversed",
    amountCents: r.amount_cents as number,
    description: (r.description as string) ?? "",
    idempotencyKey: r.idempotency_key as string,
    createdAt: r.created_at as string,
    provider: (r.provider as string | null) ?? null,
    providerTransactionId: (r.provider_transaction_id as string | null) ?? null,
    publisherRevenueCents: (r.publisher_revenue_cents as number) ?? 0,
    metadata: ((r.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
  }));
}

/** Admin aggregates over CPX data. Service-role only; caller must verify admin. */
export async function getCpxAdminStats() {
  const db = getSupabaseAdmin();
  const { data: events, error } = await db
    .from("provider_events")
    .select("external_event_id,event_type,processing_status,publisher_revenue_cents,user_reward_cents,received_at")
    .eq("provider", "cpx")
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`admin events read failed: ${error.message}`);
  const rows = events ?? [];
  const sum = (k: "publisher_revenue_cents" | "user_reward_cents", pred?: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred ?? (() => true)).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const isProcessed = (r: (typeof rows)[number]) => r.processing_status === "processed" || r.processing_status === "duplicate_processed";
  return {
    totalEvents: rows.length,
    processed: rows.filter((r) => r.processing_status === "processed").length,
    duplicates: rows.filter((r) => r.processing_status === "duplicate_processed").length,
    rejected: rows.filter((r) => r.processing_status === "rejected").length,
    orphans: rows.filter((r) => r.processing_status === "orphan_reversal").length,
    revenueCents: sum("publisher_revenue_cents", isProcessed),
    rewardsCents: sum("user_reward_cents", isProcessed),
    marginCents: sum("publisher_revenue_cents", isProcessed) - sum("user_reward_cents", isProcessed),
    recent: rows.slice(0, 50),
  };
}
