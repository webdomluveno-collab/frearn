import type { WithdrawalListItem } from "@/components/fx/wallet-view";
import {
  isKnownWithdrawalMethod,
  maskDestination,
  WITHDRAWAL_METHOD_META,
} from "@/lib/withdrawals";

export function toWithdrawalListItem(w: {
  id: string;
  amountCents: number;
  method: string;
  destination: string;
  status: string;
  createdAt: string;
}): WithdrawalListItem {
  if (!isKnownWithdrawalMethod(w.method)) {
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
