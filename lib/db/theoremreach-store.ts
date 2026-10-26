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
        user_id: callback.userId,
        reward_cents: callback.userRewardCents,
        publisher_revenue_cents: callback.publisherRevenueCents,
      },
    });
    if (error) throw new Error("TheoremReach atomic reward RPC failed");
    const row = (Array.isArray(data) ? data[0] : data) as { outcome: "rewarded" | "duplicate"; ledger_id: string } | undefined;
    if (!row || (row.outcome !== "rewarded" && row.outcome !== "duplicate") || !row.ledger_id) {
      throw new Error("TheoremReach atomic reward RPC returned an invalid result");
    }
    return { outcome: row.outcome, ledgerId: row.ledger_id };
  }
}
