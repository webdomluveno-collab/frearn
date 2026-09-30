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

/** Signed display form: +$1.35 / −$0.70. Presentation only. */
export function signedMoney(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  const abs = centsToUsd(Math.abs(cents));
  if (cents > 0) return `+${abs}`;
  if (cents < 0) return `−${abs}`;
  return abs;
}

/** Short date label (e.g. "Sep 30") in the viewer's locale. Presentation only. */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

/** Full date label (e.g. "Sep 30, 2026") in the viewer's locale. Presentation only. */
export function fullDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );
}
