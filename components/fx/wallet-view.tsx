"use client";

import { useState } from "react";
import { centsToUsd } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { toFxTransaction, type FxTransaction } from "@/lib/fx";
import type { WalletSummary } from "@/lib/wallet/ledger";
import { Button, EmptyState, SectionHeading } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";
import { TransactionList } from "@/components/fx/transactions";
import type { LedgerTransaction } from "@/types";

export function WalletView({ txns, summary }: { txns: LedgerTransaction[]; summary: WalletSummary }) {
  const [tab, setTab] = useState("activity");
  const [status, setStatus] = useState("all");
  const items: FxTransaction[] = txns.map(toFxTransaction);
  const filtered = items.filter((item) => status === "all" || item.status === status);

  const { availableCents, pendingCents, lifetimeCents } = summary;

  return (
    <>
      <SectionHeading
        eyebrow="YOUR MONEY, CLEARLY"
        title="Every little win has a home."
        description="Your rewards, your history, and a clear next step."
      >
        <Button disabled title="Withdrawals are not available yet">
          <Icon name="wallet" size={18} />
          {availableCents < siteConfig.minimumWithdrawalCents
            ? `Withdraw from ${centsToUsd(siteConfig.minimumWithdrawalCents)}`
            : "Withdraw rewards"}
        </Button>
      </SectionHeading>
      <div className="wallet-balances">
        <section className="wallet-primary">
          <div>
            <span className="eyebrow">AVAILABLE TO WITHDRAW</span>
          </div>
          <strong className="wallet-total">{centsToUsd(availableCents)}</strong>
          <p>Confirmed rewards. Ready when you are.</p>
          <span className="wallet-currency">USD</span>
        </section>
        <section className="wallet-stat">
          <span className="wallet-stat-icon">
            <Icon name="clock" size={22} />
          </span>
          <h2>Pending rewards</h2>
          <strong>{centsToUsd(pendingCents)}</strong>
          <p>
            Awaiting confirmation.
            <br />
            Not available to withdraw.
          </p>
        </section>
        <section className="wallet-stat">
          <span className="wallet-stat-icon">
            <Icon name="reward" size={22} />
          </span>
          <h2>Lifetime earned</h2>
          <strong>{centsToUsd(lifetimeCents)}</strong>
          <p>
            Every confirmed reward,
            <br />
            since your first little win.
          </p>
        </section>
      </div>
      <div className="money-note">
        <Icon name="help" size={18} />
        <p>
          Pending rewards can be confirmed or reversed after review. Your available balance
          reflects confirmed ledger activity, including adjustments and withdrawals.{" "}
          {siteConfig.withdrawalNote} Withdrawals aren&apos;t available yet.
        </p>
      </div>
      <section className="surface ledger-panel">
        <div className="ledger-heading">
          <div className="line-tabs" role="group" aria-label="Wallet history type">
            <button
              className={tab === "activity" ? "selected" : ""}
              aria-pressed={tab === "activity"}
              onClick={() => setTab("activity")}
            >
              Transaction history
            </button>
            <button
              className={tab === "withdrawals" ? "selected" : ""}
              aria-pressed={tab === "withdrawals"}
              onClick={() => setTab("withdrawals")}
            >
              Withdrawals
            </button>
          </div>
          {tab === "activity" && (
            <label className="sort-control">
              <span className="sr-only">Filter transactions by status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="reversed">Reversed</option>
              </select>
            </label>
          )}
        </div>
        {tab === "activity" ? (
          filtered.length ? (
            <TransactionList items={filtered} />
          ) : (
            <EmptyState
              icon="wallet"
              title={items.length === 0 ? "Your first win is still ahead." : "No activity with this status."}
              description={
                items.length === 0
                  ? "Confirmed rewards will appear here when you complete your first opportunity."
                  : "Choose another status to see more of your history."
              }
            />
          )
        ) : (
          <EmptyState
            icon="wallet"
            title="Withdrawals aren't available yet."
            description="When withdrawals open, your requests and their status will appear here. Nothing is owed or promised until then."
          />
        )}
      </section>
    </>
  );
}
