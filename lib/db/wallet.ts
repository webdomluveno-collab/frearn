import "server-only";

import { isSupabaseConfigured } from "@/lib/auth/server";
import { getUserLedger } from "@/lib/db/cpx-store";
import type { LedgerTransaction } from "@/types";

/** Signed-in user's ledger, or [] when the DB is not configured. Never throws for missing config. */
export async function getMyLedger(userId: string | null): Promise<LedgerTransaction[]> {
  if (!userId || !isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  return getUserLedger(userId);
}
