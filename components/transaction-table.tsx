import { StatusBadge } from "./ui/badge";
import { centsToUsd } from "@/lib/money";
import type { LedgerTransaction } from "@/types";

function labelFor(t: LedgerTransaction): string {
  switch (t.type) {
    case "survey_reward":
      return "Survey reward";
    case "offer_reward":
      return "Offer reward";
    case "reversal":
      return "Survey reversal";
    case "withdrawal":
      return "Withdrawal";
    case "adjustment":
      return "Adjustment";
    default:
      return t.type;
  }
}

function badgeFor(t: LedgerTransaction): string {
  if (t.status === "pending") return "Pending";
  if (t.status === "reversed") return "Reversed";
  return "Completed";
}

export function formatLedgerAmount(cents: number): string {
  const abs = centsToUsd(Math.abs(cents));
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return abs;
}

export function TransactionTable({ txns }: { txns: LedgerTransaction[] }) {
  if (txns.length === 0) {
    return (
      <p className="rounded-2xl border p-6 text-sm text-muted-foreground">
        No transactions yet. Complete a survey on the Earn page and your rewards will appear here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground">
          <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-3">{new Date(t.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
              <td className="p-3">{t.description || labelFor(t)}</td>
              <td className="p-3 font-mono text-xs">{t.type}</td>
              <td className="p-3"><StatusBadge status={badgeFor(t)} /></td>
              <td className="p-3 text-right font-semibold">{formatLedgerAmount(t.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
