/**
 * Offerwall.GG returns a SIGNED amount in publisher-defined "Cent" units.
 * Both the previous 70 units/USD and new 60 units/USD settings use one
 * Cent = one real US cent. Do not apply the share rate again.
 * Keep 4 fractional digits, including amounts below one cent.
 */
export const MAX_OFFERWALLGG_CENTS = 1_000_000;

export function decimalUnits4(value: string): bigint | null {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d{0,6})(?:\.\d{1,4})?$/.test(value)) return null;
  const sign = value.startsWith("-") ? -BigInt(1) : BigInt(1);
  const [whole, frac = ""] = (sign === -BigInt(1) ? value.slice(1) : value).split(".");
  const scaled = BigInt(whole) * BigInt(10000) + BigInt((frac + "0000").slice(0, 4));
  if (scaled === BigInt(0) || scaled > BigInt(MAX_OFFERWALLGG_CENTS) * BigInt(10000)) return null;
  return sign * scaled;
}

/** API currently returns JSON number with 4dp; comparisons use its canonical value. */
export function apiUnits4(value: unknown): bigint | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const string = String(value);
  if (/e/i.test(string)) return null;
  return decimalUnits4(string);
}

/** Money from authenticated API is six-decimal USD, rounded half-up to cents. */
export function payoutUsdCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000) return null;
  const decimal = value.toFixed(6);
  const [whole, fraction] = decimal.split(".");
  const cents = Number(whole) * 100 + Number(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1 : 0);
  return Number.isSafeInteger(cents) && cents <= MAX_OFFERWALLGG_CENTS ? cents : null;
}

export function isOfferwallggTxId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}
