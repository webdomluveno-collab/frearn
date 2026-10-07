/**
 * Manual withdrawal domain — pure helpers, safe to import anywhere.
 * No secrets, no DB, no network. Server routes re-validate everything;
 * client use is for UX only (error messages, masking, method metadata).
 */

/** One UI/server rule set. Migration 009 independently enforces these rules in PostgreSQL. */
export const PAYOUT_RULES = {
  revolut: {
    enabled: true, minimumCents: 10, label: "Revolut",
    destinationLabel: "Revolut @username", destinationPlaceholder: "@username",
    destinationHint: "Your Revtag, starting with @. Enter it carefully — you are responsible for its accuracy. Not “Revolut Pay”.",
  },
  cfx: {
    enabled: true, minimumCents: 10, label: "CFX (Conflux native)",
    destinationLabel: "Conflux Core Space address", destinationPlaceholder: "cfx:… (mainnet)",
    destinationHint: "Native CFX on Conflux Core Space mainnet only. Use a cfx: address, not eSpace, Ethereum or wrapped CFX.",
  },
  rvn: {
    enabled: true, minimumCents: 10, label: "RVN (Ravencoin native)",
    destinationLabel: "Ravencoin wallet address", destinationPlaceholder: "R… (Ravencoin mainnet)",
    destinationHint: "Native RVN on Ravencoin mainnet only. Wrapped RVN and other networks are not supported.",
  },
  "0g": {
    enabled: true, minimumCents: 10, label: "0G (native)",
    destinationLabel: "0G mainnet wallet address", destinationPlaceholder: "0x… (0G mainnet)",
    destinationHint: "Native 0G on 0G mainnet only. An EVM-format address does not identify its network: use a wallet on 0G, not another chain.",
  },
  iotx: {
    enabled: true, minimumCents: 10, label: "IOTX (IoTeX native)",
    destinationLabel: "IoTeX wallet address", destinationPlaceholder: "io1… or 0x… (IoTeX mainnet)",
    destinationHint: "Native IOTX on IoTeX mainnet only. IoTeX supports io1 and 0x addresses; ERC20 IOTX on Ethereum is not this payout method.",
  },
  xno: {
    enabled: true, minimumCents: 10, label: "XNO (Nano native)",
    destinationLabel: "Nano wallet address", destinationPlaceholder: "nano_… (or legacy xrb_…)",
    destinationHint: "Native XNO on Nano only. Use a nano_ or xrb_ account address, not a seed or private key.",
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
    enabled: true, minimumCents: 100, label: "Skrill",
    destinationLabel: "Skrill email", destinationPlaceholder: "you@example.com",
    destinationHint: "Skrill email for a manual transfer. Fees are deducted from the payout.",
    feeNotice: "Skrill fees are deducted from the requested amount when paid. You receive less than the requested amount. The actual fee is determined during manual payment; no fixed net amount is quoted.",
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
export const LOW_MINIMUM_NATIVE_CRYPTO_METHODS = ACTIVE_WITHDRAWAL_METHODS.filter(m => m !== "revolut" && PAYOUT_RULES[m].minimumCents === 10);
export const NATIVE_CRYPTO_NAMES = LOW_MINIMUM_NATIVE_CRYPTO_METHODS.map(m => m.toUpperCase()).join(", ");
export const SKRILL_FEE_NOTICE = PAYOUT_RULES.skrill.feeNotice;
/** Operator-supplied estimate, not a tariff or a customer net quote. Verify actual fees. */
export const SKRILL_OPERATOR_FEE_ESTIMATE = { currency: "CZK", feeMinor: 1255, approximateUpToUsdCents: 5000 } as const;
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
/** Format checks only; operators verify checksums/network and recipient before sending. */
export function isValidConfluxAddress(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v !== v.toLowerCase() && v !== v.toUpperCase()) return false;
  return /^cfx:(?:type\.(?:user|contract):)?[abcdefghjkmnprstuvwxyz0123456789]{42}$/.test(v.toLowerCase());
}
export function isValidRavencoinAddress(value: unknown): boolean {
  return typeof value === "string" && /^[Rr][1-9A-HJ-NP-Za-km-z]{33}$/.test(value.trim());
}
export function isValidIoTeXAddress(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return isValidBep20Address(v) || /^io1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(v);
}
export function isValidNanoAddress(value: unknown): boolean {
  return typeof value === "string" && /^(nano|xrb)_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/.test(value.trim());
}

export function isValidDestination(method: unknown, value: unknown): boolean {
  if (!isActiveWithdrawalMethod(method)) return false;
  switch (method) {
    case "skrill":
      return isValidEmailDestination(value);
    case "cfx":
      return isValidConfluxAddress(value);
    case "rvn":
      return isValidRavencoinAddress(value);
    case "0g":
      return isValidBep20Address(value);
    case "iotx":
      return isValidIoTeXAddress(value);
    case "xno":
      return isValidNanoAddress(value);
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
  return method === "skrill" ? normalizeEmailDestination(v) : v;
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
