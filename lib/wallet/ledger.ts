import type { LedgerTransaction } from "@/types";

/** Balance is DERIVED from confirmed ledger transactions — never stored as a float. */
export interface WalletSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
}

export function summarizeLedger(txns: LedgerTransaction[]): WalletSummary {
  let available = 0;
  let pending = 0;
  let lifetime = 0;
  for (const t of txns) {
    if (t.status === "confirmed") {
      available += t.amountCents;
      if (t.amountCents > 0) lifetime += t.amountCents;
    } else if (t.status === "pending") {
      if (t.amountCents > 0) pending += t.amountCents;
    }
    // reversed => excluded from balances
  }
  // Available cannot display negative due to pending withdrawals; clamp at 0 for UI
  return {
    availableCents: Math.max(0, available),
    pendingCents: pending,
    lifetimeCents: lifetime,
  };
}
