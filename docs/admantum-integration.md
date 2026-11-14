# AdMantum integration — staged and disabled by default

## Confirmed provider contract

- Offerwall URL: `https://www.admantum.com/offers?appid={publisher}&uid={uuid}`
- Server-to-server callback: **POST**, form-urlencoded.
- Required callback parameters: `uid`, `virtual_currency`.
- Financial callback fields used here: `transaction_id`, `status`, `of_id`, `hash`.
- `status=1` means completion; `status=0` means reversal.
- Documented hash: MD5 of the concatenated `uid + of_id + virtual_currency + Secret Key`.

The implementation uses `virtual_currency` as the final user reward in cents.
At Points Ratio 60, 60 virtual units are 60 cents ($0.60); no additional 60%
discount is applied. Provider revenue is derived as `virtual_currency / 60`
USD for audit accounting only; the unsigned `payout` parameter is never used
to authorize or calculate a credit.

## Reversal limitation

AdMantum documents that a reversal receives a new `transaction_id`, but does
not document an `original_transaction_id` or another stable binding to the
original credit. Therefore status `0` is fail-closed and returns a retryable
503 without a ledger debit. Do not replace this with a `uid + of_id` heuristic;
obtain a provider-approved reversal binding first.

## Feature flags

All are default-off:

- `ADMANTUM_ENABLED`
- `ADMANTUM_POSTBACK_ENABLED`
- `ADMANTUM_REWARD_PROCESSING_ENABLED`

No production flag is enabled by this change.
