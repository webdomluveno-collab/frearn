import { TransactionTable } from "@/components/transaction-table";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";

export default async function TransactionsPage() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
      <TransactionTable txns={txns} />
      <p className="text-xs text-muted-foreground">History derives from the immutable ledger — entries are never edited or deleted.</p>
    </div>
  );
}
