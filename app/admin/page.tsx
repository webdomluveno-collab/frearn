import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function isAdmin(_email?: string | null): boolean {
  // TODO(admin): replace with real session + allowlist check against ADMIN_EMAILS.
  // Deny by default. See middleware.ts.
  return false;
}

export default function AdminPage() {
  void isAdmin;
  const cards = [
    ["Users", "0"], ["Active users", "0"], ["Revenue", "$0.00"],
    ["User rewards", "$0.00"], ["Gross margin", "$0.00"], ["Pending withdrawals", "0"],
  ];
  return (
    <div className="container space-y-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="text-sm text-muted-foreground">Protected structure. Shows zero/empty states — no fake metrics. Sections: Overview · Users · Transactions · Withdrawals · Provider events · Fraud flags.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([k, v]) => (
          <Card key={k}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
