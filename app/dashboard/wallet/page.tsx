import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { listMyWithdrawals } from "@/lib/db/withdrawals";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { WalletView, type WithdrawalListItem } from "@/components/fx/wallet-view";
import {
  isActiveWithdrawalMethod,
  maskDestination,
  WITHDRAWAL_METHOD_META,
} from "@/lib/withdrawals";

function toListItem(w: {
  id: string;
  amountCents: number;
  method: string;
  destination: string;
  status: string;
  createdAt: string;
}): WithdrawalListItem {
  if (!isActiveWithdrawalMethod(w.method)) {
    return {
      id: w.id,
      amountCents: w.amountCents,
      method: w.method,
      methodLabel: w.method,
      // Mask server-side: the browser never receives full payout destinations.
      maskedDestination: "••••",
      status: w.status,
      createdAt: w.createdAt,
    };
  }
  return {
    id: w.id,
    amountCents: w.amountCents,
    method: w.method,
    methodLabel: WITHDRAWAL_METHOD_META[w.method].label,
    maskedDestination: maskDestination(w.method, w.destination),
    status: w.status,
    createdAt: w.createdAt,
  };
}

export default async function WalletPage() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  let withdrawals: WithdrawalListItem[] = [];
  if (user) {
    try {
      withdrawals = (await listMyWithdrawals(user.id)).map(toListItem);
    } catch {
      withdrawals = [];
    }
  }
  return <WalletView txns={txns} summary={summarizeLedger(txns)} withdrawals={withdrawals} />;
}
