"use client";

import { useState } from "react";
import type { FxTransaction } from "@/lib/fx";
import { fullDate, shortDate, signedMoney } from "@/lib/money";
import { Icon, type IconName } from "./icon";
import { Badge, ButtonLink, Modal } from "./primitives";

const icons: Record<FxTransaction["kind"], IconName> = {
  survey: "survey",
  offer: "gift",
  game: "game",
  task: "task",
  withdrawal: "wallet",
  adjustment: "plus",
  reversal: "refresh",
};

const tones: Record<FxTransaction["status"], "green" | "amber" | "red"> = {
  confirmed: "green",
  pending: "amber",
  reversed: "red",
};

export function TransactionList({
  items,
  compact = false,
}: {
  items: FxTransaction[];
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<FxTransaction | null>(null);
  return (
    <>
      <div className={`transaction-list ${compact ? "compact-transactions" : ""}`}>
        {items.map((item) => (
          <button
            key={item.id}
            className="transaction-row"
            onClick={() => setSelected(item)}
            aria-label={`${item.title}, ${signedMoney(item.amountCents)}, ${item.status}, view details`}
          >
            <span
              className={`transaction-icon ${item.kind === "survey" ? "tone-lavender" : item.kind === "game" ? "tone-peach" : item.kind === "reversal" ? "tone-red" : "tone-green"}`}
            >
              <Icon name={icons[item.kind]} />
            </span>
            <span className="transaction-description">
              <strong>{item.title}</strong>
              <span>
                {compact ? item.detail : `${shortDate(item.occurredAt)} · ${item.detail}`}
              </span>
            </span>
            <Badge tone={tones[item.status]}>{item.status}</Badge>
            <span
              className={`transaction-amount ${item.amountCents > 0 && item.status === "confirmed" ? "positive" : ""}`}
            >
              {signedMoney(item.amountCents)}
            </span>
            <Icon name="chevron" size={15} className="transaction-chevron" />
          </button>
        ))}
      </div>
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Activity details">
        {selected && (
          <>
            <div className="transaction-detail-head">
              <span className="transaction-icon tone-green">
                <Icon name={icons[selected.kind]} size={24} />
              </span>
              <h3>{selected.title}</h3>
              <strong className="big-number">{signedMoney(selected.amountCents)}</strong>
              <Badge tone={tones[selected.status]}>{selected.status}</Badge>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Reference</dt>
                <dd>{selected.id}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{fullDate(selected.occurredAt)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd className="capitalize">{selected.kind}</dd>
              </div>
              {selected.relatedId && (
                <div>
                  <dt>Original reward</dt>
                  <dd>{selected.relatedId}</dd>
                </div>
              )}
            </dl>
            <div className="notice">
              {selected.reason ??
                "This reward has been confirmed and is included in the available balance."}
            </div>
            <ButtonLink
              href="/contact"
              variant="secondary"
              className="full-width"
            >
              Ask about this activity
            </ButtonLink>
          </>
        )}
      </Modal>
    </>
  );
}
