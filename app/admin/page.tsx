import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToUsd } from "@/lib/money";
import { getSessionUser, isAdminEmail, isSupabaseConfigured } from "@/lib/auth/server";
import { getCpxAdminStats } from "@/lib/db/cpx-store";

export default async function AdminPage() {
  // Defense in depth: middleware already 404s non-admins; re-check here.
  const user = await getSessionUser();
  if (!isAdminEmail(user?.email)) notFound();

  const stats = isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await getCpxAdminStats()
    : null;

  const cards: Array<[string, string]> = stats
    ? [
        ["CPX events received", String(stats.totalEvents)],
        ["Processed", String(stats.processed)],
        ["Duplicates ignored", String(stats.duplicates)],
        ["Rejected / invalid", String(stats.rejected)],
        ["Orphan reversals", String(stats.orphans)],
        ["Publisher revenue", centsToUsd(stats.revenueCents)],
        ["User rewards", centsToUsd(stats.rewardsCents)],
        ["Gross margin", centsToUsd(stats.marginCents)],
      ]
    : [
        ["CPX events received", "—"], ["Processed", "—"], ["Duplicates ignored", "—"],
        ["Rejected / invalid", "—"], ["Orphan reversals", "—"], ["Publisher revenue", "—"],
        ["User rewards", "—"], ["Gross margin", "—"],
      ];

  return (
    <div className="container space-y-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="text-sm text-muted-foreground">
        {stats ? "Live CPX provider data. Figures derive from stored provider events — no fake metrics." : "Database is not configured — showing placeholders, not metrics."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([k, v]) => (
          <Card key={k}><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{v}</p></CardContent></Card>
        ))}
      </div>
      <section>
        <h2 className="font-semibold">Recent CPX events</h2>
        {!stats || stats.recent.length === 0 ? (
          <p className="mt-3 rounded-2xl border p-6 text-sm text-muted-foreground">No provider events received yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-3">Received</th><th className="p-3">Transaction</th><th className="p-3">Type</th>
                <th className="p-3">Status</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Reward</th>
              </tr></thead>
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={`${r.received_at}-${i}`} className="border-t">
                    <td className="p-3">{new Date(r.received_at as string).toLocaleString("en-US")}</td>
                    <td className="p-3 font-mono text-xs">{String(r.external_event_id ?? "").slice(0, 12)}…</td>
                    <td className="p-3">{r.event_type as string}</td>
                    <td className="p-3 font-mono text-xs">{r.processing_status as string}</td>
                    <td className="p-3 text-right">{centsToUsd(Number(r.publisher_revenue_cents) || 0)}</td>
                    <td className="p-3 text-right">{centsToUsd(Number(r.user_reward_cents) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Transaction ids are truncated in this view; full ids live in the database (service-role only).</p>
      </section>
    </div>
  );
}
