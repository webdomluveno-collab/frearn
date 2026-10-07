import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { FxAppShell } from "@/components/fx/app-shell";
import { displayName } from "@/lib/fx";

// Authenticated screens must be evaluated per request, including builds without local credentials.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Unconfigured (no Supabase) or signed out → sign in.
  if (!user) redirect("/login");

  const txns = await getMyLedger(user.id);
  const summary = summarizeLedger(txns);
  const email = user.email ?? "";
  const name = displayName(email);
  const initial = (name.charAt(0) || "•").toUpperCase();

  return (
    <FxAppShell email={email} initial={initial} availableCents={summary.availableCents}>
      {children}
    </FxAppShell>
  );
}
