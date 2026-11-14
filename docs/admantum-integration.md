# AdMantum integration — staged and disabled by default

## Confirmed provider contract

- Offerwall URL: `https://www.admantum.com/offers?appid={app_id}&uid={uuid}`
- Server-to-server callback: **POST**, form-urlencoded.
- Required callback parameters: `uid`, `virtual_currency`.
- Financial callback fields used here: `transaction_id`, `status`, `of_id`, `hash`.
- `status=1` means completion; `status=0` means reversal.
- Documented hash: MD5 of the concatenated `uid + of_id + virtual_currency + Secret Key`.

The Publisher ID (`451398`) is not used as the App ID. The actual App ID must
be supplied separately as `ADMANTUM_APP_ID`; until it is known, the wall stays
disabled.

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

The MD5 does not cover `status`, `transaction_id`, or `payout`. Therefore the
callback route never performs automatic financial crediting. Valid callbacks
are stored as `pending_manual_review` and return retryable 503 until AdMantum
provides an authenticated conversion lookup, a signature contract covering
those fields, or an equivalent replay-safe binding.

## Feature flags

All are default-off:

- `ADMANTUM_ENABLED`
- `ADMANTUM_CALLBACK_TOKEN`
- `ADMANTUM_POSTBACK_ENABLED`
- `ADMANTUM_REWARD_PROCESSING_ENABLED`

No production flag is enabled by this change.

## Postback URL template

```text
https://freearn.online/api/providers/admantum/postback?uid={uid}&virtual_currency={virtual_currency}&transaction_id={transaction_id}&status={status}&of_id={of_id}&hash={hash}&payout={payout}&currency={currency}&token=<ADMANTUM_CALLBACK_TOKEN>
```

The token is an operator-generated static secret configured in AdMantum and
`ADMANTUM_CALLBACK_TOKEN`; it is never logged or placed in source code.
