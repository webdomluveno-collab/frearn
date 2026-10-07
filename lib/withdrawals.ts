/**
 * Manual withdrawal domain — pure helpers, safe to import anywhere.
 * No secrets, no DB, no network. Server routes re-validate everything;
 * client use is for UX only (error messages, masking, method metadata).
 */

export const MINIMUM_WITHDRAWAL_CENTS = 10; // $0.10 — matches request_withdrawal() RPC

export const ACTIVE_WITHDRAWAL_METHODS = [
  "paypal",
  "skrill",
  "revolut",
  "sol",
  "usdc_solana",
] as const;

export type ActiveWithdrawalMethod = (typeof ACTIVE_WITHDRAWAL_METHODS)[number];

/** Planned but NOT submittable (no payout provider integrated — never collect card data). */
export const PLANNED_WITHDRAWAL_METHODS = ["card"] as const;

export interface WithdrawalMethodMeta {
  id: ActiveWithdrawalMethod;
  label: string;
  destinationLabel: string;
  destinationPlaceholder: string;
  destinationHint: string;
}

export const WITHDRAWAL_METHOD_META: Record<ActiveWithdrawalMethod, WithdrawalMethodMeta> = {
  paypal: {
    id: "paypal",
    label: "PayPal",
    destinationLabel: "PayPal email",
    destinationPlaceholder: "you@example.com",
    destinationHint: "The operator sends money manually to this email.",
  },
  skrill: {
    id: "skrill",
    label: "Skrill",
    destinationLabel: "Skrill email",
    destinationPlaceholder: "you@example.com",
    destinationHint: "The operator sends a manual Skrill-to-Skrill transfer.",
  },
  revolut: {
    id: "revolut",
    label: "Revolut",
    destinationLabel: "Revolut @username",
    destinationPlaceholder: "@username",
    destinationHint:
      "Your Revtag, starting with @. Enter it carefully — you are responsible for its accuracy. Not “Revolut Pay”.",
  },
  sol: {
    id: "sol",
    label: "SOL",
    destinationLabel: "Solana wallet address",
    destinationPlaceholder: "Solana address (base58)",
    destinationHint: "SOL on the Solana network only. Other chains are not accepted.",
  },
  usdc_solana: {
    id: "usdc_solana",
    label: "USDC (Solana)",
    destinationLabel: "Solana wallet address",
    destinationPlaceholder: "Solana address (base58)",
    destinationHint: "USDC on the Solana network only. The network must match.",
  },
};

export function isActiveWithdrawalMethod(value: unknown): value is ActiveWithdrawalMethod {
  return (
    typeof value === "string" &&
    (ACTIVE_WITHDRAWAL_METHODS as readonly string[]).includes(value)
  );
}

/** Basic email shape for PayPal/Skrill destinations. Server re-validates. */
export function isValidEmailDestination(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function normalizeEmailDestination(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Revolut Revtag: leading @, conservative charset, bounded length.
 * Never attempts to verify the account exists.
 */
export function isValidRevolutDestination(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^@[A-Za-z0-9._]{2,30}$/.test(value.trim());
}

/** Solana address: base58, 32–44 chars. Rejects other chains' formats. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function isValidSolanaAddress(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return BASE58.test(value.trim());
}

export function isValidDestination(method: ActiveWithdrawalMethod, value: unknown): boolean {
  switch (method) {
    case "paypal":
    case "skrill":
      return isValidEmailDestination(value);
    case "revolut":
      return isValidRevolutDestination(value);
    case "sol":
    case "usdc_solana":
      return isValidSolanaAddress(value);
    default:
      return false;
  }
}

export function normalizeDestination(method: ActiveWithdrawalMethod, value: string): string {
  const v = value.trim();
  return method === "paypal" || method === "skrill" ? v.toLowerCase() : v;
}

/** Strict display-string → integer cents ("5", "5.00", "5.5"). Rejects floats-as-text. */
export function parseAmountCents(input: string): number | null {
  const v = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Server-side amount gate: integer, ≥ $0.10. Balance check happens atomically in the RPC. */
export function isWithdrawableAmount(cents: unknown): cents is number {
  return typeof cents === "number" && Number.isInteger(cents) && cents >= MINIMUM_WITHDRAWAL_CENTS;
}

export type WithdrawalRequestError =
  | "invalid_amount"
  | "below_minimum"
  | "invalid_method"
  | "invalid_destination"
  | "insufficient_balance"
  | "duplicate_request"
  | "pending_withdrawal"
  | "invalid_request";

/** Masked for UI/logs. Full destinations live only in the DB (service-role). */
export function maskDestination(method: ActiveWithdrawalMethod, destination: string): string {
  const v = destination.trim();
  if (method === "paypal" || method === "skrill") {
    const at = v.indexOf("@");
    if (at <= 0) return "••••";
    const [local, domain] = [v.slice(0, at), v.slice(at + 1)];
    return `${local.slice(0, 1)}***@${domain || "•••"}`;
  }
  if (method === "revolut") {
    const handle = v.startsWith("@") ? v.slice(1) : v;
    if (handle.length < 3) return "@•••";
    return `@${handle.slice(0, 2)}***${handle.slice(-2)}`;
  }
  // sol / usdc_solana
  if (v.length < 8) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
