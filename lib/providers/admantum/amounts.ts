/**
 * AdMantum's virtual_currency is an integer number of user cents for the
 * configured 60-unit placement. Never apply another 60% multiplier.
 */
export function parseAdmantumVirtualCurrency(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,8})$/.test(value)) return null;
  const units = BigInt(value);
  return units > BigInt(0) && units <= BigInt(100_000_000) ? units : null;
}

/** 60 virtual units represent $1 provider revenue; return integer cents. */
export function providerRevenueCentsFromVirtualCurrency(units: bigint): number | null {
  if (units <= BigInt(0) || units > BigInt(100_000_000)) return null;
  const cents = (units * BigInt(100) + BigInt(30)) / BigInt(60);
  return cents <= BigInt(1_000_000_000) ? Number(cents) : null;
}

export function isAdmantumTransactionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function isAdmantumOfferId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && !/[\s\u0000-\u001f\u007f]/.test(value);
}
