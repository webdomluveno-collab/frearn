"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, SectionHeading } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";
import { TransactionList } from "@/components/fx/transactions";
import { buildActivityCsv, toFxTransaction } from "@/lib/fx";
import { centsToUsd } from "@/lib/money";
import type { LedgerTransaction } from "@/types";

const STATUSES = ["all", "confirmed", "pending", "reversed"] as const;
const KINDS = ["all", "survey", "offer", "withdrawal", "adjustment", "reversal"] as const;

export function ActivityView({
  txns,
  initialQuery = "",
}: {
  txns: LedgerTransaction[];
  initialQuery?: string;
}) {
  const [status, setStatus] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState(initialQuery);
  const [exported, setExported] = useState(false);

  const items = useMemo(() => txns.map(toFxTransaction), [txns]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (kind === "all" || item.kind === kind) &&
        (q === "" || `${item.title} ${item.id}`.toLowerCase().includes(q))
    );
  }, [items, status, kind, query]);

  function exportCsv() {
    const csv = buildActivityCsv(
      txns.filter((t) => {
        const fx = toFxTransaction(t);
        const q = query.toLowerCase().trim();
        return (
          (status === "all" || fx.status === status) &&
          (kind === "all" || fx.kind === kind) &&
          (q === "" || `${fx.title} ${fx.id}`.toLowerCase().includes(q))
        );
      })
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "freearn-activity.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
  }

  return (
    <>
      <SectionHeading
        eyebrow="NOTHING LOST IN THE DETAILS"
        title="Your little wins. The full story."
        description="Confirmed, pending, or changed — every update stays in view."
      >
        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Icon name="download" size={17} />
          Export CSV
        </Button>
      </SectionHeading>
      {exported && (
        <p role="status" className="small muted">
          Your activity export is ready.
        </p>
      )}
      <div className="activity-summary">
        <div>
          <span className="summary-dot confirmed" />
          <span>Confirmed</span>
          <strong>Available in your wallet</strong>
        </div>
        <div>
          <span className="summary-dot pending" />
          <span>Pending</span>
          <strong>Awaiting provider review</strong>
        </div>
        <div>
          <span className="summary-dot reversed" />
          <span>Reversed</span>
          <strong>Reason shown on each entry</strong>
        </div>
      </div>
      <section className="surface ledger-panel">
        <div className="activity-controls">
          <div className="line-tabs" role="group" aria-label="Activity status">
            {STATUSES.map((s) => (
              <button
                key={s}
                className={status === s ? "selected" : ""}
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
              >
                {s === "all" ? "All activity" : s}
              </button>
            ))}
          </div>
          <div className="activity-search-row">
            <div className="earn-search">
              <Icon name="search" size={17} />
              <input
                aria-label="Search activity or reference"
                placeholder="Search activity or reference"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="sort-control">
              <span className="sr-only">Filter activity type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="all">All types</option>
                {KINDS.filter((k) => k !== "all").map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className="ledger-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · latest first
        </p>
        {filtered.length ? (
          <TransactionList items={filtered} />
        ) : (
          <EmptyState
            icon="activity"
            title={items.length === 0 ? "A fresh page, ready for you." : "No matching activity."}
            description={
              items.length === 0
                ? "Your history will appear after your first opportunity."
                : "Try a different search, status, or type."
            }
          >
            {items.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus("all");
                  setKind("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            )}
          </EmptyState>
        )}
      </section>
      <div className="activity-explainer">
        <Icon name="help" size={20} />
        <div>
          <h3>Numbers with a reason.</h3>
          <p>
            A reversal subtracts a previously credited reward. Pending entries await provider
            review and are not available to withdraw. Open any entry to see its reference,
            status, and explanation.
          </p>
          {items.length > 0 && (
            <p className="small muted">
              Pending total:{" "}
              {centsToUsd(
                txns
                  .filter((t) => t.status === "pending" && t.amountCents > 0)
                  .reduce((sum, t) => sum + t.amountCents, 0)
              )}
              . History derives from the immutable ledger.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
