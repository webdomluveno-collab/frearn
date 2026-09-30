import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { WalletView } from "@/components/fx/wallet-view";

export default async function WalletPage() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  return <WalletView txns={txns} summary={summarizeLedger(txns)} />;
}
