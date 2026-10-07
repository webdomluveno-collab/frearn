/**
 * Manual withdrawal domain — pure helpers, safe to import anywhere.
 * No secrets, no DB, no network. Server routes re-validate everything;
 * client use is for UX only (error messages, masking, method metadata).
 */

/** One UI/server rule set. Migration 008 independently enforces these rules in PostgreSQL. */
export const PAYOUT_RULES = {
  revolut: {
    enabled: true, minimumCents: 10, label: "Revolut",
    destinationLabel: "Revolut @username", destinationPlaceholder: "@username",
    destinationHint: "Your Revtag, starting with @. Enter it carefully — you are responsible for its accuracy. Not “Revolut Pay”.",
  },
  paypal: {
    enabled: false, minimumCents: null, label: "PayPal",
    destinationLabel: "PayPal email", destinationPlaceholder: "you@example.com",
    destinationHint: "Historical withdrawals only. New PayPal requests are disabled.",
  },
  ltc: {
    enabled: true, minimumCents: 100, label: "Litecoin",
    destinationLabel: "Litecoin wallet address", destinationPlaceholder: "L…, M… or ltc1…",
    destinationHint: "LTC on Litecoin mainnet only. Use an L, M or ltc1 SegWit address; MWEB and other networks are not supported.",
  },
  sol: {
    enabled: true, minimumCents: 100, label: "SOL",
    destinationLabel: "Solana wallet address", destinationPlaceholder: "Solana address (base58)",
    destinationHint: "SOL on the Solana network only. Other chains are not accepted.",
  },
  usdc_solana: {
    enabled: true, minimumCents: 100, label: "USDC (Solana)",
    destinationLabel: "Solana wallet address", destinationPlaceholder: "Solana address (base58)",
    destinationHint: "USDC on the Solana network only. The network must match.",
  },
  usdc_bep20: {
    enabled: true, minimumCents: 100, label: "USDC (BEP20)",
    destinationLabel: "BNB Smart Chain wallet address", destinationPlaceholder: "0x… (BNB Smart Chain / BEP20)",
    destinationHint: "USDC on BNB Smart Chain (BEP20) only. Do not use Solana or another EVM network for this payout.",
  },
  skrill: {
    enabled: false, minimumCents: null, label: "Skrill",
    destinationLabel: "Skrill email", destinationPlaceholder: "you@example.com",
    destinationHint: "Historical withdrawals only. New Skrill requests are disabled.",
  },
} as const;

export type WithdrawalMethod = keyof typeof PAYOUT_RULES;
export type ActiveWithdrawalMethod = {
  [M in WithdrawalMethod]: typeof PAYOUT_RULES[M]["enabled"] extends true ? M : never
}[WithdrawalMethod];

export function isKnownWithdrawalMethod(value: unknown): value is WithdrawalMethod {
  return typeof value === "string" && Object.hasOwn(PAYOUT_RULES, value);
}
export function isActiveWithdrawalMethod(value: unknown): value is ActiveWithdrawalMethod {
  return isKnownWithdrawalMethod(value) && PAYOUT_RULES[value].enabled;
}
export const ACTIVE_WITHDRAWAL_METHODS = Object.keys(PAYOUT_RULES).filter(isActiveWithdrawalMethod);
/** Display/entry threshold only. Never use this to authorize a specific method. */
export const LOWEST_WITHDRAWAL_CENTS = Math.min(...ACTIVE_WITHDRAWAL_METHODS.map(m => PAYOUT_RULES[m].minimumCents));
export const WITHDRAWAL_METHOD_META = PAYOUT_RULES;
export const PLANNED_WITHDRAWAL_METHODS = ["card"] as const;
export function getWithdrawalMinimumCents(method: ActiveWithdrawalMethod): number {
  return PAYOUT_RULES[method].minimumCents;
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

/** Address shape only; payout operators must verify destinations before sending. */
export function isValidLitecoinAddress(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^[LM][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(v)
    || (/^ltc1[qp][023456789acdefghjklmnpqrstuvwxyz]{38,86}$/.test(v));
}
export function isValidBep20Address(value: unknown): boolean {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}
export function isValidDestination(method: unknown, value: unknown): boolean {
  if (!isActiveWithdrawalMethod(method)) return false;
  switch (method) {
    case "revolut":
      return isValidRevolutDestination(value);
    case "ltc":
      return isValidLitecoinAddress(value);
    case "usdc_bep20":
      return isValidBep20Address(value);
    case "sol":
    case "usdc_solana":
      return isValidSolanaAddress(value);
    default:
      return false;
  }
}

export function normalizeDestination(method: ActiveWithdrawalMethod, value: string): string {
  const v = value.trim();
  return v;
}

/** Strict display-string → integer cents ("5", "5.00", "5.5"). Rejects floats-as-text. */
export function parseAmountCents(input: string): number | null {
  const v = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Method-aware server gate. The RPC still checks the minimum and balance atomically. */
export function isWithdrawableAmount(method: unknown, cents: unknown): cents is number {
  return isActiveWithdrawalMethod(method) && typeof cents === "number"
    && Number.isSafeInteger(cents) && cents <= 2147483647
    && cents >= getWithdrawalMinimumCents(method);
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
export function maskDestination(method: WithdrawalMethod, destination: string): string {
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
  // Crypto destinations
  if (v.length < 8) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
