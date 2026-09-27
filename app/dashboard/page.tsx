import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionTable } from "@/components/transaction-table";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";

export default async function DashboardOverview() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  const s = summarizeLedger(txns);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
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
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-semibold">Start earning</p>
            <p className="text-sm text-muted-foreground">Complete surveys matched to your profile.</p>
          </div>
          <Link href="/dashboard/earn" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Go to Earn
          </Link>
        </CardContent>
      </Card>
      <section>
        <h2 className="font-semibold">Recent activity</h2>
        <div className="mt-3">
          <TransactionTable txns={txns.slice(0, 5)} />
        </div>
      </section>
    </div>
  );
}
