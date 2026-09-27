import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { TransactionTable } from "@/components/transaction-table";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";

export default async function WalletPage() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  const s = summarizeLedger(txns);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Available balance", centsToUsd(s.availableCents)],
          ["Pending", centsToUsd(s.pendingCents)],
          ["Lifetime earnings", centsToUsd(s.lifetimeCents)],
        ].map(([k, v]) => (
          <Card key={k}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div className="text-sm text-muted-foreground">
            Minimum withdrawal: {centsToUsd(siteConfig.minimumWithdrawalCents)} · {siteConfig.withdrawalNote}
          </div>
          <Button disabled title="Withdrawals are not available yet">Withdraw</Button>
          <StatusBadge status="Unavailable" />
        </CardContent>
      </Card>
      <section>
        <h2 className="font-semibold">Recent activity</h2>
        <div className="mt-3">
          <TransactionTable txns={txns.slice(0, 10)} />
        </div>
      </section>
    </div>
  );
}
