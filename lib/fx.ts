import type { LedgerTransaction, LedgerType } from "@/types";

/** Presentation-facing transaction kind (Codex visual language). */
export type FxTransactionKind =
  | "survey"
  | "offer"
  | "game"
  | "task"
  | "withdrawal"
  | "adjustment"
  | "reversal";

export type FxTransactionStatus = "confirmed" | "pending" | "reversed";

export interface FxTransaction {
  id: string;
  title: string;
  detail: string;
  amountCents: number;
  kind: FxTransactionKind;
  status: FxTransactionStatus;
  occurredAt: string;
  reason?: string;
  relatedId?: string;
}

function kindFor(t: LedgerTransaction): FxTransactionKind {
  switch (t.type as LedgerType) {
    case "survey_reward":
      return "survey";
    case "offer_reward":
      return "offer";
    case "reversal":
      return "reversal";
    case "withdrawal":
      return "withdrawal";
    case "adjustment":
      return "adjustment";
    default:
      return "adjustment";
  }
}

function statusFor(t: LedgerTransaction): FxTransactionStatus {
  if (t.status === "pending") return "pending";
  if (t.status === "reversed") return "reversed";
  return "confirmed";
}

function reversalReason(t: LedgerTransaction): string | undefined {
  if (t.type !== "reversal") return undefined;
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const reason = meta.reason;
  if (typeof reason === "string" && reason.length > 0) {
    return `Reversed${reason.startsWith("cpx_") || reason.startsWith("adgem_") ? " after provider review" : `: ${reason}`}.`;
  }
  return "This reward was reversed after provider review. Reversed amounts are not available.";
}

function relatedIdFor(t: LedgerTransaction): string | undefined {
  if (t.type !== "reversal") return undefined;
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  const id = meta.reverses_ledger_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Map a real ledger row to presentation shape. Balances are NEVER derived
 * here — only the authoritative summarizeLedger() may do that.
 */
export function toFxTransaction(t: LedgerTransaction): FxTransaction {
  const kind = kindFor(t);
  const title =
    t.description ||
    (kind === "survey"
      ? "Survey reward"
      : kind === "offer"
        ? "Offer reward"
        : kind === "reversal"
          ? "Reward reversal"
          : kind === "withdrawal"
            ? "Withdrawal"
            : "Adjustment");
  const provider = typeof t.provider === "string" && t.provider.length > 0 ? ` · ${t.provider.toUpperCase()}` : "";
  return {
    id: t.id,
    title,
    detail: `${kind === "survey" ? "Survey" : kind === "offer" ? "Offer" : kind.charAt(0).toUpperCase() + kind.slice(1)}${provider}`,
    amountCents: t.amountCents,
    kind,
    status: statusFor(t),
    occurredAt: t.createdAt,
    reason: reversalReason(t),
    relatedId: relatedIdFor(t),
  };
}

/** CSV export rows for real ledger data (reference, date, description, type, status, amount_usd). */
export function buildActivityCsv(txns: LedgerTransaction[]): string {
  const esc = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
  const rows: string[][] = [
    ["reference", "date", "description", "type", "status", "amount_usd"],
    ...txns.map((t) => [
      t.id,
      t.createdAt,
      t.description || t.type,
      t.type,
      t.status,
      (t.amountCents / 100).toFixed(2),
    ]),
  ];
  return rows.map((row) => row.map(esc).join(",")).join("\r\n");
}

export interface WeekBucket {
  label: string;
  day: string;
  cents: number;
}

/**
 * Confirmed earnings per day for the last 7 days (oldest → newest),
 * derived from real ledger rows. Timezone: UTC day buckets.
 */
export function weekBuckets(txns: LedgerTransaction[], now = new Date()): WeekBucket[] {
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets: WeekBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cents = txns
      .filter((t) => t.status === "confirmed" && t.amountCents > 0 && t.createdAt.slice(0, 10) === key)
      .reduce((sum, t) => sum + t.amountCents, 0);
    buckets.push({ label: labels[d.getUTCDay()], day: days[d.getUTCDay()], cents });
  }
  return buckets;
}

/** Display name derived from the verified account email (never invented). */
export function displayName(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
