# Freearn Control Center — implementation and integration runbook

Prepared 2026-10-25. No production deployment or live Supabase changes were performed.

## Workspace and production baseline

The requested Mac checkout `/Users/mac/Desktop/surveys` is not accessible from this Linux session. Work is in `/home/macpro/surveys-prod`, branch `codex/freearn-control-center`, based directly on freshly fetched GitHub `origin/main` **e577cd08cf0268906cf4db4fe5a7e3179c1ae088** (`feat: improve Freearn technical SEO`). The initial local `main` was clean at `1612a1a`, behind production by three commits. Its branch pointer was not moved. Remote: `https://github.com/webdomluveno-collab/frearn.git`.

The new branch includes only the production baseline and Control Center work. No referral or Freearn Worlds branch was merged or cherry-picked. The separate Mac-local `withdrawal-notify` branch is not present among this checkout's refs and was not advertised by GitHub under that name; its code cannot be reviewed here. Recheck the Mac checkout and branch before integration. Re-fetch origin/main before eventual merge; don't overwrite newer production work.

## What works locally

- `/admin/control-center`, linked from existing `/admin`; read-only server-rendered responsive reporting in Freearn's current palette/type system.
- Existing middleware authorization is preserved. Page and data loader independently require a verified session and existing `ADMIN_EMAILS` allowlist. No browser service-role key, new public reporting API, client aggregation, or admin authorization change.
- Dynamic, uncached reads. Select-only access to minimal fields on three existing tables; no new migration or RPC required. No ledger, reward callback, payout, provider gating, auth/signup flow or balance writes.
- 7-day and 30-day rolling windows and all time, in UTC. Available balances and open requests are current, irrespective of selected period.
- Explicit unavailable states, empty states and a retry link. Real zero is shown only after a complete successful read. A table read failure invalidates the whole report rather than producing partial totals.
- Old CPX event-based money cards were removed from `/admin`; operational CPX event counts and manual withdrawal actions are retained. The old latest-500 event view is explicitly labelled as a bounded audit view, not lifetime financial reporting.
- Telegram/traffic panels are integration status text, not claims of live configuration. Analytics remain `Not available`.

## Financial sources and definitions

All monetary fields are integer USD cents, validated as safe integers; unsafe sums fail closed. Code: `lib/admin/control-center.ts`, presentation: `components/admin/control-center-view.tsx`.

### Users & earnings directory

`/admin/users-and-earnings` reads only profile IDs and creation timestamps (no email), ledger rows, and minimal withdrawal request fields (no destinations/reviewer data). It pages each source in exact-count 500-row ranges with a 50,000-row cap, aggregates the complete bounded result server-side, and only then filters by user-ID substring, globally sorts by confirmed earnings, and returns one 50-user page. Any incomplete source read yields `Not available`, never a partial user list.

- Confirmed earnings are gross positive `survey_reward`, `offer_reward`, and `referral_reward` credits. Referral rewards appear in their total but remain platform-funded and are not attributed to providers or survey/offer activity.
- Confirmed negative `reversal` entries are shown separately, consistent with the existing Control Center gross-credit and reversal accounting.
- Paid withdrawals use `withdrawal_requests.status = 'paid'` and show both gross requested amount and paid-request count; all request count is separate. This remains an operator-recorded status, not proof of bank/chain settlement.
- Available, reserved, and unconfirmed balances are calculated per user by the existing `summarizeLedger`; pending holds are not deducted twice, and reversed rows remain excluded.

| Metric | Source and definition | Limits |
| --- | --- | --- |
| Reported publisher revenue by provider | Sum `ledger_transactions.publisher_revenue_cents` on positive **confirmed** `survey_reward` / `offer_reward` rows, selected by ledger `created_at`. | Revenue at durable credit time, as reported by the provider. Not actual provider cash received or a full invoice statement. Only current proven CPX, AdGem and TimeWall ledger mappings with a nonempty provider transaction ID and nonnegative revenue are covered. Unknown/unattributed mappings cause revenue/spread to be unavailable, not guessed. |
| Survey and offer rewards credited | Sum positive confirmed `survey_reward` / `offer_reward` `amount_cents`, by ledger `created_at`. | Gross survey/offer credits before subsequent reversals; excludes referral awards, manual adjustments, withdrawal refunds and pending/reversed rows. |
| Referral rewards credited | Sum positive confirmed `referral_reward` `amount_cents`, by ledger `created_at`. | Separately identified as a platform-funded reward cost. It is never attributed to a survey provider or included in provider reward-credit/user counts; gross before subsequent reversals. |
| Total rewards credited | Survey/offer rewards plus referral rewards. | Gross confirmed user reward credits before subsequent reversals; not provider revenue. |
| Credit-time spread after rewards | Covered reported credit revenue minus survey/offer and referral reward credits. | A pre-chargeback spread after reward costs, explicitly **not reconciled gross margin or net profit**. No cash-received inference. |
| Reconciled platform gross margin | **Not available**. | CPX reversal rows store zero publisher revenue; authoritative provider revenue chargebacks/settlement adjustments are not available. Cannot reliably calculate final margin. |
| Paid withdrawals | `withdrawal_requests.status = 'paid'`: count and sum gross requested `amount_cents`, filtered by **`updated_at`**, not `created_at`. | Current settlement RPC updates this timestamp when marking paid. Operator-recorded, not independent bank/chain reconciliation; historical/manual timestamp edits can limit accuracy. Actual transfer fees/net recipient amount are not stored. |
| Pending withdrawals | All rows in `requested`, `reviewing`, `approved`, `processing`: count + gross cents. | Current queue across all dates, includes legacy payment methods. Not evidence of successful transfer. |
| Current user balance liabilities | Group all ledger rows by user and call the existing `summarizeLedger`. Sum `availableCents + reservedCents` per user. Confirmed referral rewards are included as ledger credits. | Wallet operational liability: confirmed sum minus pending negative withdrawal holds, clamped per user for availability; reserved amount counted once. Pending positive rewards excluded. Reversed rows excluded; confirmed withdrawals already debit balances. Never offset one user's deficit against another's positive balance. |
| Available / reserved / unconfirmed | Sums of the existing wallet summary's `availableCents`, `reservedCents`, `pendingCents`. | Same current wallet rules; reservations are already in total liabilities. Do not add pending request amounts a second time. |
| Negative confirmed balances | Sum `max(0, -sum(confirmed amount_cents))` per user. | Separate review amount, not negative liability against other users. Active hold anomalies are not silently repaired by reporting. |
| Reversals | Confirmed negative `type='reversal'`: count and absolute amount by `created_at`. | Positive legacy corrections are excluded. Confirmed zero-amount manual withdrawal-rejection markers counted separately; those markers restore availability by voiding holds, not by issuing another reward. |
| Active rewarded users | Distinct `user_id` on positive confirmed survey/offer credits in the period. | Not logins, visitors or survey opens. Users with later reversals still had a real credit; no invented session analytics. |
| Provider audit diagnostics | Counts of `provider_events`, `held`, `rejected` and `orphan_reversal` by `received_at`. | Diagnostic only. Duplicate status can overwrite the same event; CPX complete and reversal can share a unique provider event. Never sum these statuses into financial totals. |
| Provider payments actually received | **Not available**. | No reconciled provider settlement/receipt table. |
| Advertising, operating costs, actual transfer fees, net profit | **Not available**. | No expense or fee journal. Revenue minus withdrawals must never be called profit. |

Existing schema reviewed: `database/schema.sql`, migrations `002`–`010`, `lib/db/{cpx,adgem,timewall}-store.ts`, provider processing code, `lib/wallet/ledger.ts`, `lib/db/withdrawals.ts`, `lib/auth/server.ts`, `middleware.ts`.

### Completeness and consistency

Supabase/PostgREST default row caps must not silently become totals. Each table is read in deterministic ID-ordered pages of 500 with an exact row count and a shared upper timestamp. Every page must have the expected size/count, unique IDs and valid fields. Error, changing count, truncation, unsafe arithmetic or more than 50,000 rows in any table yields `Not available`. No sampling and no false zeros. Selects omit email, destinations, raw payload, keys and review identities.

These are bounded operational reads, **not one atomic database snapshot**. Status changes during paging may be observed at different moments; count checks do not detect every status-only mutation. The UI states this limit and shows read-start UTC. Do not export as a reconciled accounting statement. At higher scale or for atomic reporting, separately review a single read-only SQL aggregation/snapshot with service-role-only execution, including the complete ledger semantics; it is not deployed or added here.

## Telegram: verified facts vs missing evidence

Verified **in source only** on production baseline:

- `010_telegram_signup_notify.sql`: AFTER INSERT on `auth.users`; async `pg_net` calls; Vault names `notify_function_url` (signup URL) and `notify_signing_secret`; exception isolation to protect signup; RLS-protected nonce store.
- `supabase/functions/notify-signup/index.ts`: HMAC/time-window verification via `_shared/verify.ts`, nonce uniqueness, Telegram secrets only on Edge Function. No bot token in SQL or callback URLs.
- Signup uses `notify_function_url`; **never replace it with the withdrawal URL**.
- Existing signup relay consumes the nonce before contacting Telegram. A network failure after claiming the nonce can lose an alert, and ambiguous Telegram responses complicate retry. It is not durable exactly-once delivery. This task does not change the existing relay.

**Not verified:** whether `notify-withdrawal` is deployed, its migration is applied, the separate Vault entry exists, or its implementation avoids the signup URL. No Supabase management connection/CLI/account is configured here; no live endpoint was probed or notification sent. The Mac-local branch is unavailable. The absence of withdrawal files in main proves only source absence, not absence of a manual deployment.

### Read-only operator verification (before any future deployment)

On the Mac, inspect without switching a dirty checkout:

```sh
git -C /Users/mac/Desktop/surveys status --short --branch
git -C /Users/mac/Desktop/surveys fetch origin
git -C /Users/mac/Desktop/surveys log -1 --oneline origin/main
git -C /Users/mac/Desktop/surveys log --oneline origin/main..withdrawal-notify
git -C /Users/mac/Desktop/surveys diff --name-status origin/main...withdrawal-notify
git -C /Users/mac/Desktop/surveys ls-tree -r --name-only withdrawal-notify -- database/migrations supabase/functions
```

Review the actual withdrawal function, trigger, tests and secret **names**, and compare all migration filenames across **production, withdrawal-notify and local referral branches** before choosing a filename. Current production has `010_telegram_signup_notify.sql`; no withdrawal migration number can be certified collision-free without those branches. If a pending withdrawal migration collides, rename only the **unapplied** migration and its tests/docs before merge; use an unused timestamp version (chosen after this review). Do not renumber or rewrite an already-applied migration.

Using an authorized Supabase account, list functions (no deployment):

```sh
supabase functions list --project-ref "$PROJECT_REF"
```

In Supabase SQL Editor, owner-only **read-only** checks (no secret values in output):

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_history;
-- Only if that table exists:
select version from supabase_migrations.schema_migrations order by version;

select n.nspname as schema_name, c.relname as table_name, t.tgname,
       p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and ((n.nspname = 'auth' and c.relname = 'users')
    or (n.nspname = 'public' and c.relname in ('withdrawal_requests', 'ledger_transactions')))
order by schema_name, table_name, t.tgname;

select name, count(*) as entries,
       bool_and(coalesce(length(decrypted_secret) > 0, false)) as configured,
       bool_and(case name
         when 'notify_function_url' then decrypted_secret like 'https://%/functions/v1/notify-signup'
         when 'notify_withdrawal_function_url' then decrypted_secret like 'https://%/functions/v1/notify-withdrawal'
         else true end) as url_matches_expected_endpoint
from vault.decrypted_secrets
where name in ('notify_function_url', 'notify_signing_secret',
               'notify_withdrawal_function_url', 'notify_withdrawal_signing_secret')
group by name order by name;

select p.proname,
       position('notify_withdrawal_function_url' in pg_get_functiondef(p.oid)) > 0 as uses_withdrawal_url,
       position('''notify_function_url''' in pg_get_functiondef(p.oid)) > 0 as references_signup_url
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.proname ilike '%notify%';
```

A missing Vault row is not configured. Require exactly one entry per expected name. Validate exact project host privately in the Dashboard; URL-pattern output alone does not establish the correct project. Migration history is not sufficient if SQL Editor was used manually: compare actual trigger/function definitions **privately** against reviewed branch SQL, check trigger enabled state and timing (`INSERT` vs `UPDATE`) in Dashboard. Do not paste full function definitions, secrets, pg_net bodies or bot-token URLs into chat/logs. These verification queries were **not run against production** in this task.

### Withdrawal completion sequence — future work, not executed

1. Obtain the actual Mac `withdrawal-notify` branch and the read-only live verification results. Reconcile source with deployed function/migration first; do not redeploy an unknown existing implementation blindly.
2. Review function with HMAC authentication, fresh timestamp, domain-specific signed payload (`withdrawal`, request ID, gross cents, payout method, minute timestamp and nonce). Match amount/method to stored request, not client input. Don't include destination, email, payment address, signing key or bot token in alerts/logs. Reuse private Telegram channel only if intended; use distinct signing keys for domain isolation.
3. Use **separate Vault `notify_withdrawal_function_url`** and preferably `notify_withdrawal_signing_secret`, matched to Edge secret `NOTIFY_WITHDRAWAL_SIGNING_SECRET`. Preserve signup's `notify_function_url` / `notify_signing_secret` and existing signup relay unchanged. Keep Telegram bot credentials in Edge secret storage only. Enter secret values privately in Dashboard, not CLI command history or committed SQL.
4. Prefer a durable RLS-protected notification outbox: unique `(notification_type, withdrawal_request_id)` inserted once after a genuinely new committed requested withdrawal. No new job from duplicate request RPC, updates, paid/rejected transitions or historical backfill. Outbox insert and withdrawal transaction must be compatible; isolate notification failures so withdrawals cannot fail due to external services. Monitor any isolated enqueue failure rather than silently treating it as delivered.
5. Worker claims jobs atomically, uses authenticated relay, records success/failure and bounded backoff. Use a stable semantic event key beyond the short-lived transport nonce. Do not claim guaranteed exactly-once Telegram delivery: its sendMessage has no caller idempotency key. Quarantine ambiguous timeouts for operator review to avoid blind duplicate sends; one source event/job prevents duplicates from callback/request retries. Alerting outages must not reverse reservations or block payouts.
6. Tests in isolated DB/staging: one valid request → one outbox job; same idempotency key and concurrent retries → no new job; status updates → none; invalid request/minimum/insufficient balance → none; missing Vault/relay outage → withdrawal still valid; bad HMAC/stale signature/replay → rejected; retry/ambiguous transport behavior explicitly tested. Signup still uses its own endpoint.
7. Resolve migration naming with referral branches and actual live history. Review final forward migration and branch diff before operator approval. Stage function, secrets and worker first, then apply reviewed trigger/outbox migration once, and run one authorized test request. Only then schedule a production deployment in a separate approved task. This runbook is not deployment authorization.

### Confirmed survey reward notifications — separate future integration

Trigger from durable ledger state, **not `provider_events.processing_status` or provider-wall opening**. Eligible: `type='survey_reward'`, `status='confirmed'`, positive integer cents, trusted provider/transaction ID, first successful credit insertion (or first pending→confirmed transition if that flow is introduced). Current CPX processing writes that ledger row before updating the provider event; a crash/retry between them must not generate another alert. AdGem and TimeWall currently write `offer_reward`, so do not label them survey completions without a separate proven classification.

Use a distinct `notify-survey-reward` relay, `notify_survey_reward_function_url`, separate signing domain/key, and outbox unique `(notification_type, ledger_id)`. Unique provider transaction/type and ledger idempotency keys are the durable source boundaries. Duplicate callback, rejected/held/orphan event, failed signature, reversal, nonpositive credit, pending-only row or mere survey opening → no job. Never enqueue by replaying all existing credits during rollout. Transaction-safe enqueue and separate delivery worker follow the same failure isolation and ambiguous-delivery rules above. Minimal alert: provider + gross credited USD + UTC minute; optional internal event reference only. No email, payment destination or unnecessary profile fields.

## Umami: precise integration proposal (not installed)

### Setup

1. Choose Umami Cloud or a separately hosted current Umami instance; if self-hosted use its own PostgreSQL database, not Freearn's financial tables, and configure backups/retention/access. Create an owner/admin account and a website for the canonical Freearn production domain. Record real website UUID, HTTPS script URL and collection host from that website's tracking code.
2. Proposed application config: `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `NEXT_PUBLIC_UMAMI_SCRIPT_URL`; optional server-only `UMAMI_API_URL`, `UMAMI_API_KEY` **only** if embedding real admin metrics later. Website ID is public; an API key is not needed for browser tracking. Don't invent values or enable a tracker without configured real credentials. Scope keys/team access to the intended website where supported.
3. In a separate implementation task, add a single `next/script` loader in `app/layout.tsx` (`afterInteractive`), enabled only for the configured production domain; restrict `data-domains`, exclude hashes, and define a `data-before-send` sanitizer on `window` **before** loading the tracker. Start with pageviews only, no replay, heatmap, distinct IDs, user identification or performance telemetry. Check chosen Umami version's attributes rather than mixing v2/v3 behavior.
4. Sanitizer cancels `/admin`, `/api`, `/auth/callback`, reset/update-password and provider relay/wall routes; never send login tokens, OAuth codes, payment addresses or arbitrary search strings. Normalize allowed route paths, use static non-PII titles; strip query/hash and userinfo from referrers. For landing URLs retain only **allowlisted campaign values** for `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, bounded in length and checked against campaign slugs the operator defined. Drop every other parameter. Setting `data-exclude-search=true` alone would also discard UTM; use the reviewed sanitizer if UTM attribution is wanted. Test malicious URLs and payloads before activation.
5. Umami tracks History API navigation; do not also send a pageview on every React effect. Verify exactly one pageview on initial load and route transitions. Configure script/collection host in any CSP. Keep tracking failure independent of auth/earn/withdrawal behavior; don't bypass blockers or consent choices.

### What to measure

| Need | Implementation / interpretation |
| --- | --- |
| Visitors / pageviews | Native Umami visitors and pageviews for permitted routes. No local homemade unique counter. Anonymous identifiers are estimates with rotating identity; not signed-in user counts. |
| Countries | Umami's country breakdown from its own supported geolocation pipeline; no raw IP storage or application-side IP forwarding. Country can be unknown; never fill from payout/profile data. |
| Sources | Sanitized referrer origin/path; direct/unknown remains direct/unknown. |
| UTM campaigns | Standard five UTM keys, only reviewed campaign slugs; preserve attribution without arbitrary query strings. |
| Registrations | A named `signup_completed` **after a server-trusted newly-created auth user**, not submit-button click, signUp request success, generic login or every `/auth/callback`. |

The present `components/auth-forms.tsx` calls Supabase signUp directly. Success can be unconfirmed and may be an obfuscated response for an existing address. `app/auth/callback/route.ts` exchanges codes for both email confirmation and OAuth and does not establish a new-account conversion. Neither is a reliable unique registration event by itself.

For real registration conversions, plan a server-controlled one-use registration-conversion/outbox record keyed to the actual `auth.users` INSERT, consumed by a same-origin, verified-user endpoint after signup confirmation/first session. Return a boolean grant, not email/UUID to Umami; the client emits once only when granted. Repeated callbacks/login/refresh/StrictMode must not grant again. Use a separate `signup_confirmed` event if email confirmation rather than account creation is the chosen definition. Resolve how consent/ad blockers can prevent delivery and how sanitized landing campaign context reaches that confirmed session, especially cross-device email confirmation. Do not claim complete conversion coverage or attach UTM guesses. A server-side Umami event without a browser session cannot automatically inherit that visit's attribution; design correlation/privacy explicitly before implementation. Internal DB event keys may be used for dedup, never send them to analytics.

No email, auth UUID/distinct ID, DOB, raw IP, wallet destination, payment method/amount, provider callback payload, secret or raw authentication URL goes to Umami. Configure retention and update the privacy notice for the actual deployment; cookie-free tracking is not a blanket consent exemption. Do not add Telegram signup notices as Umami data.

### Validation and later admin metrics

Use a staging Umami website first. Inspect network payloads on landing with approved UTM, Next route changes, login/signup confirmation, replayed callback, admin, auth reset and wallet forms. Test no-script/unconfigured, consent declined, blocked tracker and network outage. No email/token/payment data, no duplicate conversion, no duplicate pageview. Create an Umami goal for `signup_completed` (or the explicitly chosen confirmation definition) and compare a controlled new registration with an existing-user attempt and subsequent login.

Only with real account/API access add an admin-authenticated server integration for totals/country/source/UTM/conversions, with UTC filters, bounded cache by website+period and safe errors. Store API key server-only. Without that connection, keep every metric `Not available`. No public share link or iframe that bypasses admin authorization.

Official references checked 2026-10-25:
- [Umami tracker configuration](https://docs.umami.is/docs/tracker-configuration): domains, before-send hook, URL privacy attributes.
- [Umami SPA tracking](https://docs.umami.is/docs/guides/track-single-page-apps): automatic history navigation tracking.
- [Umami tracker functions](https://docs.umami.is/docs/tracker-functions), [events](https://docs.umami.is/docs/track-events), [UTM](https://docs.umami.is/docs/utm), [metric definitions](https://docs.umami.is/docs/metric-definitions), [API authentication](https://docs.umami.is/docs/api/authentication).
- [Supabase database webhooks](https://supabase.com/docs/guides/database/webhooks), [Vault](https://supabase.com/docs/guides/database/vault), [Edge Functions](https://supabase.com/docs/guides/functions).

## Acceptance and exact next steps

1. Run full tests, typecheck, lint and production build; inspect responsive Control Center at 320/390/768/1440px with empty, unavailable and supplied large-value fixtures. Financial/admin tests must cover denial before DB access, row-cap completeness, real zeros vs unavailable, reversals, reservations, per-user negative balances and correct time columns. Fixtures never replace authenticated live routes.
2. Commit only locally on this isolated branch. No new migrations are needed to run the Control Center against the current schema; authorize no production changes from this task.
3. Transfer/review this branch on the actual Mac; refresh production main, resolve only legitimate baseline changes, run the same checks with real local configuration. Review financial definitions with the operator, then separately approve production rollout. For atomic/month-end accounting, implement a reviewed snapshot solution before treating this as a statement.
4. Obtain the actual withdrawal-notify and referral branches plus read-only live Supabase verification. Complete the withdrawal checklist above in its own integration change; preserve signup URL and resolve migration collisions before any SQL application.
5. Create the Umami account/website and agree on account-created vs email-confirmed conversion and privacy/attribution rules. Implement sanitizer and trusted one-use conversion flow in a separate review, validate staging, then separately approve activation. Until then no traffic metrics are claimed.

## Validation results

- Complete suite: **519/519 tests**, 42 files, including 43 new reporting/access/completeness/render tests. Existing provider, ledger, withdrawal and signed-signup tests are retained.
- `npm run typecheck`: passed.
- `npm run lint`: passed, no warnings or errors.
- `npm run build`: passed, including dynamic `/admin/control-center`; no live DB reads during build.
- Visual checks: the real server-rendered reporting component with production-built CSS and local DM Sans, supplied test fixtures only (large totals, empty and unavailable). All 12 state/viewport combinations at 320, 390, 768 and 1440px had no horizontal overflow. No authenticated production data was accessed or fabricated in the app.
- Protected production paths (database, auth, provider callbacks/integrations, wallet/ledger, withdrawals, Supabase functions and middleware) have no diff from the fetched production baseline.
- Supabase plugin discovery found an available, uninstalled integration. No connection was made; live deployment/Vault/migration checks remain unverified. The documented owner-only SQL checks or an explicitly connected Supabase account are needed to finish that verification.

Final branch/commit and clean Git status are reported in the task response after the local commit. No push, deployment or production database changes.
