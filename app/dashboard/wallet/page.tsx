import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
        <Badge tone="info">Demo figures</Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Available balance", "$8.42"], ["Pending", "$1.20"], ["Lifetime earnings", "$26.85"]].map(([k, v]) => (
          <Card key={k}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div className="text-sm text-muted-foreground">Minimum withdrawal: $5.00 · {siteConfig.withdrawalNote}</div>
          <Button disabled title="Unavailable in pre-launch">Withdraw</Button>
          <StatusBadge status="Unavailable in pre-launch" />
        </CardContent>
      </Card>
    </div>
  );
}
