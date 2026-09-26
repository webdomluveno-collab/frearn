import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityCard } from "@/components/opportunity-card";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { DEMO_OPPORTUNITIES } from "@/lib/providers/mock";

const demoLedger = [
  { id: "1", userId: "demo", type: "survey_reward" as const, status: "confirmed" as const, amountCents: 2685, description: "Demo lifetime", idempotencyKey: "d1", createdAt: new Date().toISOString() },
  { id: "2", userId: "demo", type: "survey_reward" as const, status: "pending" as const, amountCents: 120, description: "Demo pending", idempotencyKey: "d2", createdAt: new Date().toISOString() },
  { id: "3", userId: "demo", type: "withdrawal" as const, status: "confirmed" as const, amountCents: -1843, description: "Demo withdrawals", idempotencyKey: "d3", createdAt: new Date().toISOString() },
];

export default function DashboardOverview() {
  const s = summarizeLedger(demoLedger);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <Badge tone="info">Demo data</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Available balance", centsToUsd(s.availableCents)],
          ["Pending rewards", centsToUsd(s.pendingCents)],
          ["Lifetime earnings", centsToUsd(s.lifetimeCents)],
        ].map(([k, v]) => (
          <Card key={k}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <section>
        <h2 className="font-semibold">Recommended for you</h2>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;re preparing opportunities for your region. Sample layout below.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {DEMO_OPPORTUNITIES.map((o) => <OpportunityCard key={o.id} opp={o} demo />)}
        </div>
      </section>
    </div>
  );
}
