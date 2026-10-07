"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { centsToUsd } from "@/lib/money";
import { siteConfig } from "@/config/site";
import { toFxTransaction, type FxTransaction } from "@/lib/fx";
import type { WalletSummary } from "@/lib/wallet/ledger";
import {
  ACTIVE_WITHDRAWAL_METHODS,
  maskDestination,
  isValidDestination,
  LOWEST_WITHDRAWAL_CENTS,
  parseAmountCents,
  WITHDRAWAL_METHOD_META,
  type ActiveWithdrawalMethod,
} from "@/lib/withdrawals";
import { Badge, Button, EmptyState, Progress, SectionHeading } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";
import { TransactionList } from "@/components/fx/transactions";
import type { LedgerTransaction } from "@/types";

/** Server-masked withdrawal row — the browser never receives full destinations. */
export interface WithdrawalListItem {
  id: string;
  amountCents: number;
  method: string;
  methodLabel: string;
  maskedDestination: string;
  status: string;
  createdAt: string;
}

const ERROR_COPY: Record<string, string> = {
  invalid_amount: "Enter a positive USD amount with up to two decimal places.",
  pending_withdrawal: "You already have a withdrawal under review. Wait until it is paid or rejected.",
  invalid_request: "This request could not be verified. Refresh your wallet and try again.",
  insufficient_balance: "That amount is more than your available balance.",
  invalid_method: "Choose an available payout method.",
  invalid_destination: "Check the destination — it doesn't look valid for this method.",
  duplicate_request: "This request was already submitted.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  unauthenticated: "Please sign in again and try again.",
  unavailable: "Withdrawals are temporarily unavailable. Please try again later.",
};

function statusTone(status: string): string {
  if (status === "paid") return "green";
  if (status === "rejected") return "red";
  return "amber";
}

function statusHelp(status: string): string {
  if (status === "paid") return "Your withdrawal has been sent.";
  if (status === "rejected")
    return "This withdrawal was not completed. Reserved funds were returned to your available balance.";
  return "Your withdrawal is waiting for review.";
}

function WithdrawalForm({ availableCents, onDone }: { availableCents: number; onDone: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ActiveWithdrawalMethod>("revolut");
  const [destination, setDestination] = useState("");
  const [stage, setStage] = useState<"edit" | "review">("edit");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One idempotency key per review instance: retries and double-clicks
  // collapse server-side instead of deducting twice.
  const requestKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null
  );

  const meta = WITHDRAWAL_METHOD_META[method];
  const minimumCents = meta.minimumCents;
  const minimumError = `${meta.label} minimum is ${centsToUsd(minimumCents)}.`;
  const cents = useMemo(() => parseAmountCents(amount), [amount]);
  const destOk = useMemo(
    () => isValidDestination(method, destination),
    [method, destination]
  );

  function review(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (cents === null || cents <= 0) return setError(ERROR_COPY.invalid_amount);
    if (cents < minimumCents) return setError(minimumError);
    if (cents > availableCents) return setError(ERROR_COPY.insufficient_balance);
    if (!destOk) return setError(ERROR_COPY.invalid_destination);
    setStage("review");
  }

  async function submit() {
    if (busy || cents === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          amountCents: cents,
          method,
          destination: destination.trim(),
          requestKey: requestKey.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error === "below_minimum" ? minimumError : ERROR_COPY[data.error ?? "unavailable"] ?? ERROR_COPY.unavailable);
        setStage("edit");
        return;
      }
      onDone();
      router.refresh();
    } catch {
      setError(ERROR_COPY.unavailable);
      setStage("edit");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "review" && cents !== null) {
    return (
      <div className="surface settings-panel" aria-live="polite">
        <div className="settings-panel-heading">
          <h2>Check your request</h2>
          <p className="muted small">Funds are reserved only when you confirm.</p>
        </div>
        <dl className="review-list">
          <div>
            <dt>Amount</dt>
            <dd>{centsToUsd(cents)}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{meta.label}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd className="mono">{maskDestination(method, destination)}</dd>
          </div>
        </dl>
        <p className="muted small">
          Most requests are reviewed within approximately 1 hour; exceptional cases may take up to 3 days.
          Reserved funds return to your balance if a request is rejected.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setStage("edit")} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy} aria-busy={busy}>
            {busy ? "Submitting…" : `Confirm ${centsToUsd(cents)} withdrawal`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="surface settings-panel"
      onSubmit={review}
      aria-label="Request a withdrawal"
      noValidate
    >
      <div className="settings-panel-heading">
        <h2>Request a withdrawal</h2>
        <p className="muted small">
          Manual review at launch. Reserved funds return if a request is rejected.
        </p>
      </div>
      <div className="field">
        <label htmlFor="wd-amount">Amount (USD)</label>
        <div className="amount-row">
          <input
            id="wd-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={(minimumCents / 100).toFixed(2)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby="wd-amount-help"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAmount((availableCents / 100).toFixed(2))}
          >
            Max
          </Button>
        </div>
        <p className="muted small" id="wd-amount-help">
          {meta.label} — Minimum {centsToUsd(minimumCents)}. Available: {centsToUsd(availableCents)}.
        </p>
      </div>
      <div className="field">
        <span className="field-label" id="wd-method-label">
          Payout method
        </span>
        <div className="method-grid" role="group" aria-labelledby="wd-method-label">
          {ACTIVE_WITHDRAWAL_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              className={method === m ? "selected" : ""}
              aria-pressed={method === m}
              onClick={() => {
                setMethod(m);
                setDestination("");
                setError(cents !== null && cents > 0 && cents < WITHDRAWAL_METHOD_META[m].minimumCents
                  ? `${WITHDRAWAL_METHOD_META[m].label} minimum is ${centsToUsd(WITHDRAWAL_METHOD_META[m].minimumCents)}.` : null);
              }}
            >
              {WITHDRAWAL_METHOD_META[m].label}
            </button>
          ))}
          <button type="button" disabled title="No card payout provider integrated yet">
            Card — Coming soon
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor="wd-destination">{meta.destinationLabel}</label>
        <input
          id="wd-destination"
          autoComplete="off"
          spellCheck={false}
          placeholder={meta.destinationPlaceholder}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          aria-describedby="wd-destination-help"
        />
        <p className="muted small" id="wd-destination-help">
          {meta.destinationHint}
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="full-width">
        Review withdrawal
      </Button>
    </form>
  );
}

export function WalletView({
  txns,
  summary,
  withdrawals,
  withdrawalsUnavailable = false,
}: {
  txns: LedgerTransaction[];
  summary: WalletSummary;
  withdrawals: WithdrawalListItem[];
  withdrawalsUnavailable?: boolean;
}) {
  const [tab, setTab] = useState("activity");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [justRequested, setJustRequested] = useState(false);
  const items: FxTransaction[] = txns.map(toFxTransaction);
  const filtered = items.filter((item) => status === "all" || item.status === status);

  const { availableCents, pendingCents, lifetimeCents } = summary;
  const hasActiveWithdrawal = withdrawals.some((w) => ["requested", "reviewing", "approved", "processing"].includes(w.status));
  const canWithdraw = availableCents >= LOWEST_WITHDRAWAL_CENTS && !hasActiveWithdrawal && !justRequested && !withdrawalsUnavailable;
  const progress = Math.min(100, (availableCents / LOWEST_WITHDRAWAL_CENTS) * 100);

  return (
    <>
      <SectionHeading
        eyebrow="YOUR MONEY, CLEARLY"
        title="Every little win has a home."
        description="Your rewards, your history, and a clear next step."
      >
        {canWithdraw ? (
          <Button onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>
            <Icon name="wallet" size={18} />
            {showForm ? "Close withdrawal form" : "Withdraw rewards"}
          </Button>
        ) : (
          <Button disabled title={`Withdrawals open at ${centsToUsd(LOWEST_WITHDRAWAL_CENTS)}`}>
            <Icon name="wallet" size={18} />
            {withdrawalsUnavailable ? "Withdrawals unavailable" : hasActiveWithdrawal || justRequested ? "Withdrawal under review" : `Withdraw from ${centsToUsd(LOWEST_WITHDRAWAL_CENTS)}`}
          </Button>
        )}
      </SectionHeading>
      {justRequested && (
        <div className="notice" role="status">
          <Icon name="check" size={16} />
          <p>Request received — it is now pending manual review.</p>
        </div>
      )}
      <div className="wallet-balances">
        <section className="wallet-primary">
          <div>
            <span className="eyebrow">AVAILABLE TO WITHDRAW</span>
          </div>
          <strong className="wallet-total">{centsToUsd(availableCents)}</strong>
          <p>Confirmed rewards, minus any reserved withdrawals.</p>
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
      {withdrawalsUnavailable && <div className="notice notice-warning" role="alert">Withdrawal history could not be loaded. Refresh your wallet before requesting a withdrawal.</div>}
      {hasActiveWithdrawal && <div className="notice" role="status">One withdrawal at a time. Your existing request must be paid or rejected before you can request another.</div>}
      {availableCents < LOWEST_WITHDRAWAL_CENTS && (
        <section className="surface threshold-panel" aria-label="Withdrawal threshold">
          <div>
            <strong>
              {centsToUsd(availableCents)} / {centsToUsd(LOWEST_WITHDRAWAL_CENTS)}
            </strong>
            <p className="muted small">
              Revolut or PayPal withdrawals open at {centsToUsd(LOWEST_WITHDRAWAL_CENTS)}. Every little win counts
              toward it.
            </p>
          </div>
          <Progress value={progress} label="Progress toward the withdrawal minimum" />
        </section>
      )}
      {showForm && canWithdraw && (
        <WithdrawalForm
          availableCents={availableCents}
          onDone={() => {
            setShowForm(false);
            setJustRequested(true);
            setTab("withdrawals");
          }}
        />
      )}
      <div className="money-note">
        <Icon name="help" size={18} />
        <p>
          Pending rewards can be confirmed or reversed after review. Your available balance
          reflects confirmed ledger activity, including adjustments and withdrawals.{" "}
          Revolut and PayPal from {centsToUsd(WITHDRAWAL_METHOD_META.paypal.minimumCents)}; crypto from {centsToUsd(WITHDRAWAL_METHOD_META.sol.minimumCents)}. {siteConfig.withdrawalNote} Most requests are reviewed within approximately 1 hour; exceptional cases
          may take up to 3 days. Timing is estimated, not guaranteed.
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
              Withdrawals{withdrawals.length > 0 ? ` (${withdrawals.length})` : ""}
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
        ) : withdrawals.length ? (
          <ul className="wd-list">
            {withdrawals.map((w) => (
              <li key={w.id} className="wd-row">
                <span className="wd-icon" aria-hidden="true">
                  <Icon name="wallet" size={18} />
                </span>
                <span className="wd-main">
                  <strong>
                    {centsToUsd(w.amountCents)} · {w.methodLabel}
                  </strong>
                  <span className="muted small">
                    {w.maskedDestination} ·{" "}
                    {new Date(w.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="muted small">{statusHelp(w.status)}</span>
                </span>
                <Badge tone={statusTone(w.status)}>
                  {w.status === "requested" ? "Pending" : w.status === "paid" ? "Paid" : w.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="wallet"
            title="No withdrawals yet."
            description="Your withdrawal requests will appear here with their review status."
          />
        )}
      </section>
    </>
  );
}
