/** Homepage illustration only. Never import into reward, ledger or payout code. */
export const EXAMPLE_PROVIDER_REWARD_CENTS = 148;
export function payoutPreview(requestedShare: number) {
  const share = Number.isFinite(requestedShare)
    ? Math.min(85, Math.max(50, Math.round(requestedShare)))
    : 50;
  const rewardCents = Math.round((EXAMPLE_PROVIDER_REWARD_CENTS * share) / 100);
  const startingCents = Math.round(EXAMPLE_PROVIDER_REWARD_CENTS / 2);
  return { share, rewardCents, differenceCents: rewardCents - startingCents };
}
