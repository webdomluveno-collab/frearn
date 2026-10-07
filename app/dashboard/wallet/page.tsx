import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { listMyWithdrawals } from "@/lib/db/withdrawals";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { WalletView, type WithdrawalListItem } from "@/components/fx/wallet-view";
import { toWithdrawalListItem } from "@/lib/withdrawal-presentation";

export default async function WalletPage() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  let withdrawals: WithdrawalListItem[] = [];
  let withdrawalsUnavailable = false;
  if (user) {
    try {
      withdrawals = (await listMyWithdrawals(user.id)).map(toWithdrawalListItem);
    } catch {
      withdrawalsUnavailable = true;
    }
  }
  return <WalletView txns={txns} summary={summarizeLedger(txns)} withdrawals={withdrawals} withdrawalsUnavailable={withdrawalsUnavailable} />;
}
