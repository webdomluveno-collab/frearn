import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/auth/server";
import { THEOREMREACH_PROVIDER_KEY, type TheoremreachStore } from "@/lib/providers/theoremreach/process";

const UNIQUE_VIOLATION = "23505";

export class SupabaseTheoremreachStore implements TheoremreachStore {
  constructor(private readonly db: SupabaseClient = getSupabaseAdmin()) {}

  async processRewardAtomically(callback: Parameters<TheoremreachStore["processRewardAtomically"]>[0]) {
    const { data, error } = await this.db.rpc("process_theoremreach_reward", {
      p_user_id: callback.userId,
      p_tx_id: callback.txId,
      p_reward_cents: callback.userRewardCents,
      p_publisher_revenue_cents: callback.publisherRevenueCents,
      p_raw_payload: {
        tx_id: callback.txId,
        transaction_id: callback.entryTransactionId,
        user_id: callback.userId,
        reward_cents: callback.userRewardCents,
        publisher_revenue_cents: callback.publisherRevenueCents,
      },
    });
    if (error) throw new Error("TheoremReach atomic reward RPC failed");
    const row = (Array.isArray(data) ? data[0] : data) as
      | { outcome: "rewarded" | "duplicate" | "reversal_pending"; ledger_id: string | null }
      | undefined;
    if (!row) throw new Error("TheoremReach atomic reward RPC returned an invalid result");
    if (row.outcome === "reversal_pending") return { outcome: "reversal_pending" as const, ledgerId: null };
    if ((row.outcome !== "rewarded" && row.outcome !== "duplicate") || !row.ledger_id) {
      throw new Error("TheoremReach atomic reward RPC returned an invalid result");
    }
    return { outcome: row.outcome, ledgerId: row.ledger_id };
  }

  async processReversalAtomically(reversal: Parameters<TheoremreachStore["processReversalAtomically"]>[0]) {
    const { data, error } = await this.db.rpc("process_theoremreach_reversal", {
      p_event_id: reversal.eventId,
      p_user_id: reversal.userId,
      p_tx_id: reversal.txId,
      p_raw_payload: reversal.rawPayload,
    });
    if (error) throw new Error("TheoremReach atomic reversal RPC failed");
    const row = (Array.isArray(data) ? data[0] : data) as
      | { outcome: "reversed" | "duplicate" | "orphan_reversal"; ledger_id: string | null }
      | undefined;
    if (!row) throw new Error("TheoremReach atomic reversal RPC returned an invalid result");
    if (row.outcome === "orphan_reversal") return { outcome: "orphan_reversal" as const, ledgerId: null };
    if ((row.outcome !== "reversed" && row.outcome !== "duplicate") || !row.ledger_id) {
      throw new Error("TheoremReach atomic reversal RPC returned an invalid result");
    }
    return { outcome: row.outcome, ledgerId: row.ledger_id };
  }

  async processBanAtomically(ban: Parameters<TheoremreachStore["processBanAtomically"]>[0]) {
    const { data, error } = await this.db.rpc("process_theoremreach_ban", {
      p_event_id: ban.eventId,
      p_user_id: ban.userId,
      p_reason: ban.reason,
      p_raw_payload: ban.rawPayload,
    });
    if (error) throw new Error("TheoremReach atomic ban RPC failed");
    const row = (Array.isArray(data) ? data[0] : data) as { outcome: "banned" | "duplicate" } | undefined;
    if (!row || (row.outcome !== "banned" && row.outcome !== "duplicate")) {
      throw new Error("TheoremReach atomic ban RPC returned an invalid result");
    }
    return { outcome: row.outcome };
  }
}
