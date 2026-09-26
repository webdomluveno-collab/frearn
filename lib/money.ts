/** Money helpers — integer cents only. Never use floats for balances. */

export function centsToUsd(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Reward per minute in cents, rounded to 1 decimal dollar display. */
export function rewardPerMinute(rewardCents: number, minutes: number): string {
  if (minutes <= 0) return "—";
  const perMin = rewardCents / minutes / 100;
  return `$${perMin.toFixed(2)}/min`;
}

export function parseUsdToCents(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}
