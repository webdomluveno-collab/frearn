# Offerwall.GG: safe live-integration rollout

Documentation: https://offerwall.gg/developers/quickstart and https://offerwall.gg/developers/postbacks

## Rewards: 60% users / 40% Freearn

- In the actual Offerwall.GG publisher placement, set **Units per USD earned = 60**.
- Keep the currency as **Cent** (each unit is one U.S. cent).
- A provider conversion yielding $1 pays 60 Cent to the user; Freearn keeps $0.40 before reversals, costs and taxes.
- Former conversions at 70 units/USD keep their ORIGINAL signed amounts; never reprice them.
- The callback `currencyAmount` already holds the amount owed to the user. Do NOT multiply by 0.60 a second time.
- The Decimals shown field only controls the wall display, not the callback's fractional precision.

## Preview (already operational)

- The admin-only iframe preview is controlled by OFFERWALLGG_PREVIEW_ENABLED=true.
- Existing settings: OFFERWALLGG_PUBLIC_KEY, OFFERWALLGG_SECRET_KEY, OFFERWALLGG_TEST_POSTBACK_ENABLED=true.
- Ensure verified placement, supported embedding domains, and server-side signed wall links.

## New financial gates: DEFAULT OFF

- OFFERWALLGG_POSTBACK_ENABLED=false (set true only when real callback validation is ready).
- OFFERWALLGG_REWARD_PROCESSING_ENABLED=false (set true only after safe database RPC rollout).
- OFFERWALLGG_WALL_ENABLED=false (public earning requires all three gates plus service role).

GET or POST (form-urlencoded) callback endpoint:
https://freearn.online/api/providers/offerwallgg/postback

- HMAC-SHA256 verification over the exact `userId:transactionId:currencyAmount` bytes.
- Real callbacks additionally reconcile against authenticated GET /api/v1/conversions and its authoritative status/payout.
- Database RPC process_offerwallgg_conversion is the ONLY writer; its SQL file is database/migrations/019_offerwallgg_atomic_rewards.sql.
- It keeps 4 decimal places of a Cent and accumulates fractional cents across conversions.
- It serializes writes by user and transaction, deduplicates events, and protects reversal-before-credit.
- Tests with test=1 are acknowledged only with test gate on, and never write money.
- Failed provider checks, DB errors and API lag return non-2xx to trigger provider retries.

## Before enabling public earning

1. Confirm the Offerwall.GG dashboard actually SAVED 60 units/USD, the 'Cent' currency and verified website.
2. Configure the postback URL with no macros (Offerwall.GG appends fields), and enable Require signature for wall links.
3. Build and test this branch in preview without financial variables enabled.
4. Review and safely apply the SQL RPC on Supabase; check for security advisories. Existing ledger remains untouched at deployment.
5. Exercise the official dashboard's signed test callback, forged signature rejection, and a small real credit/reversal in a controlled pilot.
6. Only with passing database and pilot checks, enable postback processing first and public wall last.

Do not confuse fast crypto transfer after payout with real publisher payout terms (NET30; $30 minimum).