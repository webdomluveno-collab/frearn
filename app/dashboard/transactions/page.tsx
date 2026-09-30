import { ActivityView } from "@/components/fx/activity-view";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  return <ActivityView txns={txns} initialQuery={searchParams?.q ?? ""} />;
}
