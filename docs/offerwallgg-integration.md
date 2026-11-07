# Offerwall.GG — safe staged integration

Official publisher documentation:
- https://offerwall.gg/developers/quickstart
- https://offerwall.gg/developers/postbacks
- https://offerwall.gg/legal/publisher-terms

## Current state: preview/test ONLY (NO EARNING)

- The site verification file already lives at /offerwall.txt.
- Admin-only preview in Earn is enabled only with OFFERWALLGG_PREVIEW_ENABLED=true, an ADMIN_EMAILS allowlisted login, a valid 32-hex public placement key, and its secret.
- Preview URLs deliberately **omit userId**. The provider says this disables attributable clicks.
- Test GET callback verifies HMAC-SHA256 over userId:transactionId:currencyAmount and returns "1" only when test=1.
- **Every real callback returns 503.** There are no DB writes and no misleading "credited" acknowledgements.
- DO NOT put a live earning wall in front of users with this integration. DO NOT turn on real traffic until atomic reward/reversal logic is added and tested.

## Needed Netlify variables for preview

- OFFERWALLGG_PUBLIC_KEY (32 lower/upper hex characters, public placement key)
- OFFERWALLGG_SECRET_KEY (server-only, Functions scope; never NEXT_PUBLIC)
- OFFERWALLGG_PREVIEW_ENABLED=true (optional; defaults OFF)
- OFFERWALLGG_TEST_POSTBACK_ENABLED=true (optional; defaults OFF)
- OFFERWALLGG_LINK_EXPIRY_ENABLED=true only if placement enforces expiring signed links
- Existing ADMIN_EMAILS must include the pilot's login email.

The placement must be **verified and active**. If site verification is pending, check /offerwall.txt from a browser and request a new placement verification in the provider dashboard.

Provider test callback URL (GET, no macros; provider will append fields):
https://freearn.online/api/providers/offerwallgg/postback

## Financial blocking issues, BEFORE a live launch

1. Freearn's balances are integer **cents**. Placement was previously discussed as **700 units per USD** (not 70); a raw callback for 700 units MUST NOT be stored as 700 cents ($7). The mapping and rounding policy must be confirmed against the actual placement configuration.
2. currencyAmount can contain up to four fractional decimals; define exact rounding/subcent accumulation, avoiding floating-point arithmetic and under/overcredit.
3. Implement **atomic**, service-role-only ledger and provider-event RPCs with idempotency by transactionId, reversal-before-credit handling and consistent postback retries.
4. The postback signature only authenticates userId, transactionId, currencyAmount; it **does not** sign payoutUsd, status, test, or offer details. Any financial publisherRevenueCents must be reconciled against the authenticated /api/v1/conversions API, and status/test handling must be safe.
5. Reversal uses same transactionId with a negative amount. Ensure a reversal doesn't get treated as a duplicate or allow a late credit afterward.
6. Keep the preview separate from any financial launcher and do not send an unsigned or non-attributed wall to real users.

## Publisher cashflow

Offerwall.GG minimum $30 cleared, NET30 from month-end. FaucetPay can arrive within minutes AFTER being paid, not immediately after a conversion. It is NOT an instant cash reserve for Freearn.
