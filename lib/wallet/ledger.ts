import type { LedgerTransaction } from "@/types";

/** Balance is DERIVED from confirmed ledger transactions — never stored as a float. */
export interface WalletSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  /** Funds locked by pending withdrawal requests (reserved, not spendable). */
  reservedCents: number;
}

export function summarizeLedger(txns: LedgerTransaction[]): WalletSummary {
  let available = 0;
  let pending = 0;
  let lifetime = 0;
  let reserved = 0;
  for (const t of txns) {
    if (t.status === "confirmed") {
      available += t.amountCents;
      if (t.amountCents > 0) lifetime += t.amountCents;
    } else if (t.status === "pending") {
      if (t.amountCents > 0) pending += t.amountCents;
      // Pending withdrawal holds reserve funds immediately: a second request
      // must observe the reduced balance (enforced atomically in the RPC;
      // this keeps every derived view consistent with it).
      else if (t.type === "withdrawal") reserved += -t.amountCents;
    }
    // reversed => excluded from balances
  }
  // Available cannot display negative due to pending withdrawals; clamp at 0 for UI
  return {
    availableCents: Math.max(0, available - reserved),
    pendingCents: pending,
    lifetimeCents: lifetime,
    reservedCents: reserved,
  };
}
