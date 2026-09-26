import { StatusBadge } from "@/components/ui/badge";

const rows = [
  { date: "2026-09-20", description: "Consumer Preferences (demo)", type: "survey_reward", status: "Completed", amount: "+$1.20" },
  { date: "2026-09-18", description: "Mobile Gaming Study (demo)", type: "survey_reward", status: "Pending", amount: "+$2.40" },
  { date: "2026-09-10", description: "Adjustment (demo)", type: "adjustment", status: "Reversed", amount: "$0.00" },
];

export default function TransactionsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date + r.description} className="border-t">
                <td className="p-3">{r.date}</td><td className="p-3">{r.description}</td>
                <td className="p-3 font-mono text-xs">{r.type}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right font-semibold">{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Demo rows for layout. Real history derives from the immutable ledger.</p>
    </div>
  );
}
