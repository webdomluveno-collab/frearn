# OfferwallApi — safe callback foundation

Callback URL:

```text
https://freearn.online/api/offerwallapi/postback
```

The endpoint supports POST query/form values `subId`, `transId`, `reward`,
`status`, `debug`, and `signature2`. It verifies:

```text
HMAC-SHA256(subId + transId + reward, OFFERWALLAPI_SECRET_KEY)
```

`subId` must be the exact UUID previously sent by Freearn; no trimming,
case-folding or fuzzy matching is allowed. GET is only a safe registration
healthcheck and never confirms a conversion.

Live status 1/2 callbacks remain fail-closed with HTTP 503 and do not write
financial data. `debug=1` is acknowledged only after signature verification
and has no financial effect. Before enabling money, a reviewed provider_events
and atomic ledger implementation is still required for status/idempotency and
chargeback handling.
