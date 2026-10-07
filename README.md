# Freearn (freearn.online)

Global rewards platform — pre-launch MVP. Earn by completing surveys (later: offers, games, research, app testing, microtasks). Transparent rewards, ledger-based wallet, provider-neutral architecture.

> Brand, logo, colors, metadata, support email, and domain are centralized in `config/site.ts` (+ CSS tokens in `app/globals.css`). No other file should hardcode them.

## 1. Prerequisites

- Node.js 20+ · npm 10+
- (Optional) Supabase project for auth/database
- (Later) Provider credentials (e.g. BitLabs) after publisher approval

## 2. Installation

```bash
npm install
cp .env.example .env.local
npm run dev      # http://localhost:3000
```

## 3. Environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL (sitemap/OG) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth/DB (optional in pre-launch) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never expose |
| `MOCK_PROVIDER_ENABLED` | `true` dev / `false` prod. Mock demo data only |
| `BITLABS_APP_TOKEN` / `BITLABS_SECRET` | Server-only future credentials |
| `BITLABS_CALLBACK_ENABLED` | Keep `false` until approved + spec implemented |
| `ADMIN_EMAILS` | Comma-separated admin allowlist |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Defaults to `support@freearn.online` |
| `TIMEWALL_POSTBACK_SECRET` | From TimeWall publisher dashboard. **Secret, server-only.** |
| `TIMEWALL_POSTBACK_ENABLED` | Must be exactly `true`, otherwise TimeWall postbacks are rejected. |
| `TIMEWALL_WALL_URL` | Official TimeWall Placement URL (public). Empty until placement approved. |

## 4. Local development

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## 5. Database setup

1. Create a Supabase project (Postgres).
2. Run `database/schema.sql` in the SQL editor, then `database/migrations/002_cpx_provider.sql`
   (ledger provider columns, provider-event status, signup trigger, Row Level Security).
3. Run `database/migrations/004_fix_reversal_unique_index.sql`, then
   `database/migrations/005_withdrawals.sql` (withdrawal request columns,
   atomic `request_withdrawal()` / `settle_withdrawal()` RPCs).
4. Set Supabase env vars (URL, anon key, service-role key).
5. Balances are **derived** from `ledger_transactions` (see `lib/wallet/ledger.ts`). Money is integer cents in TS, `NUMERIC`/cents in Postgres — never floats.

## 5b. Manual withdrawals (live, operator-reviewed)

- Method-specific minima: Revolut / Revtag and native CFX, RVN, 0G, IOTX, XNO **10 cents ($0.10)**; Litecoin, SOL, USDC (Solana), USDC (BEP20 / BNB Smart Chain) and Skrill **100 cents ($1.00)**. Skrill amount is gross; the actual transfer fee is deducted from payout, not charged as a second wallet debit.
  `PAYOUT_RULES` in `lib/withdrawals.ts` supplies server and UI values; migration 009 independently enforces the allowlist/minima in the authoritative RPC. Executable PostgreSQL tests check parity.
- `POST /api/withdrawals/request` (session auth, rate-limited): validates
  integer cents, method allowlist, and destination, then calls the atomic RPC.
  Funds are reserved immediately as a pending negative withdrawal ledger row,
  so the same balance can never be requested twice — even concurrently
  (`pg_advisory_xact_lock` per user + idempotency keys).
- Rejection refunds exactly once via an immutable zero-amount reversal marker;
  approval confirms the hold. Both admin actions are idempotent
  (`POST /api/admin/withdrawals/[id]/approve|reject`, deny-by-default 404).
- Active methods: Revolut (@username), CFX (Conflux Core Space), RVN (Ravencoin), 0G (mainnet), IOTX (IoTeX), XNO (Nano), Skrill, Litecoin (LTC), SOL, USDC (Solana), USDC (BEP20 / BNB Smart Chain).
  PayPal is disabled for new requests; historical records still display and can be settled by admins.
  Card is shown as Soon — no card data is ever collected or stored.
- Destinations are masked in UI/logs; full values live only in
  `withdrawal_requests` (service-role/RLS-protected). Apply migrations through
  `009_native_crypto_and_skrill.sql` before deploying this version.

## 6. How the mock provider works

- `lib/providers/mock.ts` returns 3 clearly-labeled demo opportunities.
- `isMockAllowed()`: on in dev, off in production unless `MOCK_PROVIDER_ENABLED=true`.
- Mock never grants real rewards and never validates callbacks.
- UI marks all mock content with a “Demo” badge.

## 7. Future BitLabs credentials

1. Get approved as a publisher; obtain app token + secret.
2. Set `BITLABS_APP_TOKEN`, `BITLABS_SECRET`, `BITLABS_CALLBACK_ENABLED=true` (server env only).
3. Implement signature verification per provider spec in `lib/providers/bitlabs.ts` + `app/api/providers/bitlabs/callback/route.ts` (idempotency via `provider_events(provider, external_event_id)` unique key).
4. Do not claim partnership until live.

## 8. Deployment

Vercel (recommended) or any Node host:

```bash
npm run build
```

Set production env: real `NEXT_PUBLIC_SITE_URL`, `MOCK_PROVIDER_ENABLED=false`, Supabase keys, no provider secrets in client bundle.

### 8b. Static hosting (plain HTML upload)

If your hosting only serves static files (no Node.js):

```bash
npm run export:static
```

This builds the site into `./out/` (or use the ready-made `project-static.zip`).
Upload the **contents** of `out/` (not the folder itself) to your hosting —
`index.html`, folders per page, `_next/` assets, `sitemap.xml`, `robots.txt`.

Notes for the static version:
- Clean URLs (`/faq/`, `/dashboard/`) work on any host serving directory indexes.
- The waitlist form switches to a one-click email fallback (no `/api` on static hosts).
- Login/register/dashboard are interactive UI demos; real auth needs the Node version + Supabase.
- `/admin/` is a zero-data placeholder structure.

## 9. CPX Research integration (live provider)

Freearn's first real survey provider is **CPX Research** (App ID `36592`, site `https://freearn.online`).
CPX shows users surveys inside an embedded SurveyWall; completions arrive as
server-to-server postbacks that credit the immutable ledger exactly once.

### 9.1 What it does

- Authenticated user opens **Earn → Surveys** → personal SurveyWall URL is minted
  **server-side** for that user's stable auth UUID (`ext_user_id`).
- CPX calls `GET /api/providers/cpx/postback` on completion.
- The endpoint validates shape + signature, stores a `provider_events` row,
  inserts one `survey_reward` ledger row (integer cents), and the user's
  available balance updates (derived, never a mutable float).
- A later `status=2` postback creates an immutable `reversal` row linked to the
  original — the original is never edited or deleted.

### 9.2 Environment variables (server-only — never `NEXT_PUBLIC_*`)

| Var | Value / source |
|---|---|
| `CPX_APP_ID` | `36592` (public; code defaults to it when unset) |
| `CPX_APP_SECURE_HASH` | From CPX dashboard: app/panel → secure hash. **Secret.** |
| `CPX_POSTBACK_SECRET` | Optional; when empty, `CPX_APP_SECURE_HASH` is used (CPX uses one secret for both purposes). |
| `CPX_POSTBACK_ENABLED` | Must be exactly `true`, otherwise postbacks are rejected (fail closed). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for auth + DB. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required by the postback endpoint (server-only). |
| `ADMIN_EMAILS` | Comma-separated admin login emails (admin dashboard + `/admin` gate). |

The CPX secure hash lives in the CPX publisher panel for App 36592 (usually
labeled "Secure hash" / "App secure hash" in the app or postback settings).
It is only ever read in `lib/providers/cpx/server.ts` (guarded by
`import "server-only"`) and never leaves the server.

### 9.3 SurveyWall URL generation

`lib/providers/cpx/server.ts#buildSurveyWallUrl` builds, per authenticated user:

`https://offers.cpx-research.com/index.php?app_id=36592&ext_user_id={uuid}&secure_hash={md5(uuid-secret)}&email={email}&subid_1=&subid_2=`

- `ext_user_id` = Supabase `auth.users.id` from the trusted server session.
- `secure_hash` = `MD5("{ext_user_id}-{CPX_APP_SECURE_HASH}")` via `node:crypto`.
- All params URL-encoded (`URLSearchParams`). Email is included; no other PII.
- The browser receives only the finished URL (hash included, as CPX requires) —
  never the secret.

### 9.4 Callback endpoint + exact Main Postback URL

`GET /api/providers/cpx/postback` accepts: `status, trans_id, user_id,
amount_local, amount_usd, offer_id, hash` (+ optional `sub_id, sub_id_2, ip_click`).

**Paste this exact URL into the CPX dashboard (Main Postback URL):**

```text
https://freearn.online/api/providers/cpx/postback?status={status}&trans_id={trans_id}&user_id={user_id}&sub_id={subid}&sub_id_2={subid_2}&amount_local={amount_local}&amount_usd={amount_usd}&offer_id={offer_ID}&hash={secure_hash}&ip_click={ip_click}
```

Expert postbacks intentionally **not** configured yet: Screen Out, Bonus/Rating,
Event Canceled.

Success responses return plain-text `1` (HTTP 200); rejections return `0` with
4xx/5xx. Signature = `MD5("{trans_id}-{postback_secret}")` per the CPX dashboard
Postback Settings, compared timing-safe. Rewards use `amount_local` (CPX already applies the 0.70 currency
factor); `amount_usd` is stored as publisher revenue for margin accounting.

### 9.5 Reward assumptions (CPX panel: factor 0.70 / bonus 1.00)

- `amount_local` is treated as the **authoritative per-user reward** — Freearn
  does NOT re-apply the 70% factor (that would double-discount).
- `amount_usd` is treated as the **publisher payout**; margin = revenue − reward.
- Both are parsed as exact decimal strings into integer cents (no floats).

### 9.6 Idempotency

- `provider_events` has `UNIQUE(provider, external_event_id)`.
- `ledger_transactions` has partial `UNIQUE(provider, provider_transaction_id)`
  plus per-row `idempotency_key` (`cpx:{trans_id}:reward`, `cpx:{trans_id}:reversal`).
- Concurrent duplicate callbacks race on the constraints; losers are acknowledged
  as duplicates without new ledger rows.

### 9.7 Reversals (`status=2`, possibly 15–60 days later)

1. Find the original `survey_reward` by `(cpx, trans_id)`.
2. Re-verify the callback signature.
3. Skip if a reversal already exists (idempotent).
4. Insert `reversal` row for `−original` cents with `metadata.reverses_ledger_id`.
5. If the confirmed sum goes negative (user already withdrew), keep the owed
   state and insert a `fraud_flags` row for review. No external charging, ever.

### 9.8 Local testing

```bash
npm test            # 20 tests: hashes, money parsing, reward/duplicate/reversal, guards
```

End-to-end (needs Supabase keys + `CPX_APP_SECURE_HASH` in `.env.local`):
1. `database/schema.sql`, then `database/migrations/002_cpx_provider.sql` in Supabase SQL editor.
2. Register at `/register`, confirm email, sign in.
3. Open `/dashboard/earn` — the Surveys iframe loads your personal wall URL
   (check `/api/providers/cpx/wall` returns a URL with your user id).
4. Simulate CPX with `curl` (compute the test hash first):
   `GET /api/providers/cpx/postback?status=1&trans_id=...&user_id=...&amount_local=1.40&amount_usd=2.00&offer_id=...&hash=...`
   → `1`; repeat → `1` with no second row; wrong hash → `0` (403).
5. `status=2` with the same `trans_id` → reversal row appears in Transactions.

### 9.9 Deploy (Netlify, server runtime REQUIRED)

The postback endpoint needs a Node server — do NOT deploy the static export
(`npm run export:static` drops `/api/*`). `netlify.toml` pins
`npm run build` with publish `.next` (Next.js Runtime). Required dashboard env:
`CPX_APP_SECURE_HASH`, `CPX_POSTBACK_ENABLED=true`, Supabase keys,
`ADMIN_EMAILS`, `MOCK_PROVIDER_ENABLED=false`.

Operational gotchas learned the hard way (Sep 2026):

- **One site per domain.** Two Netlify sites claiming `freearn.online` meant the
  domain was served by a stale duplicate (`freearnofficial`) with edge access
  control on — every CPX postback died with HTTP 401 before reaching our code
  (our endpoint has no 401 path; a bad signature is 403). Keep exactly one
  production site per domain and delete accidental duplicates.
- **No access control on the postback path.** Netlify password/edge-access
  protection returns 401 to server-to-server callers that cannot log in.
  The production site must be publicly reachable.
- **The domain must actually resolve.** Delegating to Netlify nameservers
  without a Netlify DNS zone leaves the domain completely dark (no DNS answer).
  Either create the zone first (Team → Domains → Add domain) or keep external
  DNS (`A @ → 75.2.60.5`, `CNAME www → <site>.netlify.app`).

## 10. AdGem Server Postback v3 receiver (crediting LIVE)

AdGem is the second provider. Only the backend postback receiver is
implemented — no iframe/offerwall. CPX is untouched.

### 10.1 What it does

`POST /api/providers/adgem/postback` (JSON, `Signature` header):

1. Rate limit → `ADGEM_POSTBACK_ENABLED=true` + `ADGEM_POSTBACK_KEY` set, else 503.
2. Read the EXACT RAW body (`await req.text()`), HMAC-SHA256 hex over raw bytes,
   timing-safe compare with `Signature` → 401 on mismatch (mirrors AdGem's own
   reference code, which returns 200-empty on success, 401 on failure).
3. Strict shape validation → 400 (`conversion_type` must be present;
   `amount` must be an integer ≥ 0 within cap; only `reward`/`install` supported).
4. `player_id` must be an existing Supabase UUID (never created) → 422 if unknown.
5. Verified `reward` events are CREDITED exactly once (ledger-anchored
   idempotency, §10.3) → 200 empty. `install` events are recorded
   non-monetarily. Retries → 200 duplicates. DB failure → 500 (safe retry).

### 10.2 Confirmed money mapping (publisher property config)

Property: Virtual Currency cent/cents, Currency Multiplier 70, Rounded.
AdGem defines the multiplier as "amount of virtual currency to give user for
every $1 earned", so for THIS property `data.amount` arrives as whole USD
cents of the user's reward: `amount:35` → **+35¢**, `amount:70` → **+70¢**.
Freearn applies NO further math (no second multiplier, no division) — locked
by unit tests and a source guard. `data.payout_cents` is stored as
`publisher_revenue_cents` (audit/margin only) and NEVER determines the balance.
Ledger rows: `provider='adgem'`, `type='offer_reward'`, `status='confirmed'`,
`provider_transaction_id = conversion_id[:goal_id]`. Descriptions name the
offer/goal (e.g. `Offer reward (AdGem Coin Master — Reach Level 10)`).
If the property configuration ever changes, this mapping MUST be revisited.

### 10.3 Idempotency + crash/race safety (ledger-anchored)

- Money verdicts consult the LEDGER first, never the event row alone:
  existing reward (same user) → duplicate; missing reward → credit.
- Deterministic keys: `adgem:{conversion_id}[:{goal_id}]:reward` plus the DB
  composite unique `(provider, provider_transaction_id, type)` — concurrent
  duplicates collapse on constraints; losers re-read and acknowledge.
- A crash between event insert and ledger insert resolves to a CREDIT on
  retry, never to a silent loss: the event row alone can never finalize.
- Event marked `processed` only AFTER the ledger write succeeds; a throw
  after a successful credit still converges via retry → duplicate.
- Distinct goals/conversions never collapse (never keyed by bare `offer_id`).
- Request-id reuse across different conversions → rejected + fraud flag.
- No migration needed: existing generic columns + constraints suffice.

### 10.4 Historical `held` events (pre-mapping receiver)

The first AdGem implementation stored verified rewards as `held` without
crediting because the amount unit was unconfirmed. Those rows (if any exist)
are LEFT UNTOUCHED — no backfill, no auto-credit, no mutation. To audit:
`select * from provider_events where provider='adgem' and processing_status='held'`.

### 10.5 Reversals — none defined

Re-fetched docs.adgem.com "Server-to-Server Postbacks (v3)" during this task:
zero mentions of chargeback/reversal/refund/cancel/clawback. Only `reward`
(monetary) and `install` (non-monetary) conversion types exist. Unknown types
are rejected with no value. Unchanged from the previous implementation.

### 10.6 Deliberately NOT implemented

- IP whitelisting — docs recommend it; needs the static IP from AdGem support
  before an `ADGEM_WHITELIST_IP` check can be added.
- Timestamp replay window — docs specify none; relying on signature + idempotency.

### 10.7 Test locally

```bash
npm test   # AdGem: signature / validation / process / route / guards + wallet suites
```

End-to-end (needs Supabase keys + `ADGEM_POSTBACK_KEY` in `.env.local`):
sign a JSON body with HMAC-SHA256 (hex) using the key, POST to
`/api/providers/adgem/postback` with header `Signature: <hex>`,
`player_id` = a real user UUID, `conversion_type: "reward"`, `amount: 35` →
`200` empty + one confirmed `offer_reward` (+35¢). Replay → `200`, still one row.

### 10.8 AdGem Web Offerwall (Earn UI)

`/dashboard/earn` shows provider tabs — **Surveys** (existing CPX wall,
unchanged) and **Offers & Games** (AdGem) — with only the selected wall
mounted. The AdGem URL is minted per request by `GET /api/providers/adgem/wall`
(requires session; `playerid` comes from server auth only) as
`https://adunits.adgem.com/wall?appid=<id>&playerid=<uuid>` via
`lib/providers/adgem/wall.ts`. The App ID defaults to the documented `33683`
and can be overridden with optional `ADGEM_APP_ID` (public, non-secret — no
manual setup required). The iframe reuses the CPX sizing/loading/error UX with
minimal sandbox permissions and no `allow` attribute. An empty third-party wall
is rendered as-is, never faked and never treated as an app error.

## 11. TimeWall integration (postback ingesting, crediting HELD, wall pending approval)

Placement: **Freearn** · ID `6154a2b1f8661a69` · Offerwall (iFrame) · **PENDING APPROVAL**.
The Placement URL is not available yet — nothing is guessed or constructed.
`TIMEWALL_WALL_URL` stays empty, `isTimewallWallAvailable()` is false, and the
Earn UI renders no TimeWall tab.

### 11.1 What it does

`GET /api/providers/timewall/postback` (server-only):

1. Rate limit → `TIMEWALL_POSTBACK_ENABLED=true` + `TIMEWALL_POSTBACK_SECRET` set, else 503.
2. Extract raw query strings → charset validation (guarantees raw == decoded
   for hashing) → SHA256(`userid` + `revenue_raw` + secret) hex, timing-safe
   compare with `hash` → 403 on mismatch.
3. Strict shape validation → 400 (`userid` UUID, `txid`, decimal `revenue`,
   integer `currency`, 64-hex `hash`, non-empty `type`).
4. `userid` must resolve to an existing profile (never created) → 422 if unknown.
5. Verified events are stored ONCE in `provider_events` (`provider='timewall'`,
   `external_event_id=txid`, unique) → 200 `"1"`. Retries → 200 duplicates.
6. **No ledger row is written for any event yet** (see §11.3): verified events
   are stored with `processing_status='held_awaiting_type_confirmation'`.
   DB/internal failure → 500 (provider retries; nothing falsely marked processed).

### 11.2 Confirmed money mapping (publisher placement config)

Placement: Currency=cents, Decimals=No, conversion rate 70; dashboard
demonstrates $1.00 revenue → 70 cents to user. Therefore `currency` arrives as
whole USD cents of the user's reward: `currency=70` → **+70¢** (never 49¢ —
no second multiplier is applied anywhere, locked by unit + source-guard tests).
`revenue` is publisher revenue in decimal dollars (`revenue=1.00` → 100¢),
parsed with exact decimal math (`0.5` stays `"0.5"` for hashing; sub-cent
`0.002` rounds to 0¢ exactly). Revenue is stored in `publisher_revenue_cents`
(audit/margin only) and NEVER determines the balance.

### 11.3 Why crediting is HELD (unproven `type` semantics)

No public TimeWall postback documentation is reachable (site Cloudflare-blocked)
and `type`/`withdrawid`/`reason` meanings cannot be proven. Monetary crediting
is therefore gated on `TIMEWALL_CREDITABLE_TYPES`, which ships EMPTY: every
verified event is stored durably as held, none credits. The credit code path
(type `offer_reward`, verbatim `currency` cents, deterministic
`timewall:{txid}:reward` key, ledger-anchored idempotency) is fully implemented
and tested via injected allowlist — enabling it later is a one-line change once
TimeWall confirms the earn `type` value. Unknown types are NEVER mapped to
positive balance, and no reversal behavior is implemented (no chargeback
semantics found — see §11.5).

### 11.4 Idempotency + crash/race safety (ledger-anchored)

- Event key: `UNIQUE(provider, external_event_id)` on `txid` — exact redelivery
  → `duplicate`, acknowledged 200.
- Reward identity: `provider_transaction_id = txid` + deterministic
  `timewall:{txid}:reward` key + composite unique `(provider, txn, type)`.
- Money verdicts consult the LEDGER first: a crash between event insert and
  ledger insert resolves to a credit on retry, never a silent loss; concurrent
  duplicates collapse on constraints, losers re-read and acknowledge.
- Same txid + different user → rejected + fraud flag, no second ledger.
- No migration was needed: existing generic columns + constraints suffice.

### 11.5 Reversals / chargebacks — NOT implemented (unproven)

`type`, `withdrawid`, and `reason` are stored as audit metadata only. No
reversal/chargeback semantics could be proven from reachable documentation, so
no monetary reversal path exists. Do not infer `type` values.

### 11.6 IP allowlist — deliberately NOT enforced

TimeWall documents three sending IPs (`18.156.132.55`, `51.81.120.73`,
`142.111.248.18`, latter two being retired), but the app runs behind Netlify's
proxy and there is no verified, spoof-proof mechanism to recover the true
client IP here (a client-supplied `X-Forwarded-For` prefix cannot be trusted,
so enforcing an allowlist on it would be theater that could also lock out
legitimate callbacks). Authentication rests SOLELY on the cryptographic hash
until Netlify's official client-IP mechanism is verified. Rate limiting still
applies per observed IP on a best-effort basis.

### 11.7 Test locally

```bash
npm test   # TimeWall: hash / money / process / route / wall / guards suites
```

End-to-end (needs Supabase keys + `TIMEWALL_POSTBACK_SECRET` in `.env.local`):
`GET /api/providers/timewall/postback?userid=<real UUID>&txid=<id>&revenue=1.00&currency=70&type=<any>&hash=<sha256 hex of userid+revenue+secret>`
→ `200 "1"` + one `provider_events` row (`held_awaiting_type_confirmation`,
`user_reward_cents=0`). Replay → `200`, still one row. Wrong hash → `403`.

### 11.8 Steps needed after TimeWall approval

1. Paste the official Placement URL into `TIMEWALL_WALL_URL` (Netlify env),
   e.g. `https://timewall.io/users/login?oid=6154a2b1f8661a69`. The builder
   preserves `oid` and appends the session UUID as `uid` (outbound wall:
   `uid=<authenticated UUID>`; inbound postback stays `userid` — different).
2. Confirm the earn `type` value (dashboard/docs/test postback) and add it to
   `TIMEWALL_CREDITABLE_TYPES` in `lib/providers/timewall/process.ts` + tests.
3. Confirm the acknowledgement format (`200 "1"` assumed from CPX convention).
4. Replay any `held_awaiting_type_confirmation` events if crediting is desired
   (no automatic backfill exists by design).

## 11b. TheoremReach integration — Phase 1 / TESTING ONLY (no money moves)

> Phase 1 exists to obtain real callback/entry test vectors from the
> TheoremReach dashboard. It is NOT production-ready: no callback can
> credit, debit, reverse, or otherwise change any balance.

### 11b.1 What Phase 1 does

- Server-only signed direct-entry URL builder (`lib/providers/theoremreach/server.ts`):
  `https://theoremreach.com/respondent_entry/direct` + `api_key`, `user_id`
  (session UUID), fresh `transaction_id` per mint, `currency_name_plural=cents`,
  `currency_name_singular=cent`, `exchange_rate=70`, `external_id` (user UUID),
  `partner_id` (placement), `hash` = base64url HMAC-SHA1 over the pre-hash URL.
- Authenticated wall route `GET /api/providers/theoremreach/wall`
  (401 unauthenticated / 503 unconfigured / 200 `{url}` + `private, no-store`).
- Safe postback endpoint `GET /api/providers/theoremreach/postback`:
  `debug=true` → `200 "1"` with ZERO writes (no ledger, no provider event,
  no reversal, no fraud flag); every non-debug callback fails closed
  (`400` malformed / `403` unverified) and persists nothing.
- Registry entry (`surveyWalls.theoremreach`) gated on api key + secret +
  placement presence. NOT exposed in the Earn UI (no tab, no card, no iframe).

### 11b.2 Publisher configuration (dashboard)

- Name Freearn, Platform Web, `https://freearn.online`, currency cent/cents,
  Exchange Rate 70, server-side callbacks, reversals enabled.
- Intended Reward Callback URL (enter after Phase 1 is deployed):
  `https://freearn.online/api/providers/theoremreach/postback`
  (TheoremReach appends all parameters itself — keep the endpoint clean).
- Env (all server-only, never `NEXT_PUBLIC_`): `THEOREMREACH_API_KEY`,
  `THEOREMREACH_SECRET_KEY`, `THEOREMREACH_POSTBACK_ENABLED`,
  `THEOREMREACH_PLACEMENT_ID` (see `.env.example`).

### 11b.3 Intended money model (DOCUMENTED ONLY — disabled)

- `reward` = future user cents, verbatim: `reward=70` → 70¢.
  NEVER apply another 70% multiplier (that would credit 49¢).
- `currency` = publisher USD revenue: `currency=1.00` → `publisherRevenueCents=100`.
- Pure mapping helpers + unit tests exist in `shared.ts`; no runtime credit
  path reaches them (the postback route writes nothing at all).

### 11b.4 Signature status (UNPROVEN — fail closed)

- Proven: HMAC-SHA1 + secret, base64url (`+`→`-`, `/`→`_`, strip `=`,
  no newlines) — for the ENTRY link only.
- UNPROVEN: the exact callback signed payload (fields/order/serialization).
  No callback verifier exists on purpose; non-debug callbacks get `403`.
- `status` is deprecated and never consulted. `tx_id` vs `transaction_id`
  identity mapping is unresolved — both are captured, `tx_id` preferred.

### 11b.5 Explicitly disabled in Phase 1

Reward crediting, reversal debiting, Earn tab/card/iframe exposure, and any
ledger or provider-event writes for TheoremReach. Tests pin all of these.

### 11b.6 Exact next step (Phase 2)

Deploy Phase 1, run the dashboard's entry test (`debug=true`) and Test
Server Callback, capture the real callback shape + signature test vectors
safely (dashboard shows them; Freearn logs nothing), prove the callback
HMAC payload, then implement verified crediting + reversals.

## 12. Security considerations before production

- [ ] Legal review of `/privacy` + `/terms` (placeholders marked TODO).
- [x] Real Supabase Auth wired (email verification via `/auth/callback`; enable it in Supabase Auth settings).
- [x] Admin auth via `ADMIN_EMAILS` + middleware session check (deny-by-default 404 kept).
- [x] RLS migration written (`database/migrations/002_cpx_provider.sql`) — **you must apply it**; verify policies in Supabase (see §5).
- [ ] Persistent rate limiting (current `lib/rate-limit.ts` is in-memory placeholder).
- [x] CPX signature verification + idempotency tests implemented — **you must confirm hash formulas/response with CPX docs** (see §9.4 and final checklist below).
- [ ] Raw provider payloads never exposed to users; admin-only.
- [ ] Support email / domain set (`support@freearn.online` — configured).
- [ ] No secrets with `NEXT_PUBLIC_` prefix except anon key + URL.

### Withdrawal policy migrations (006 → 007 → 008 → 009)

Apply migrations in order through `009_native_crypto_and_skrill.sql` before deploying this version. Migration 006 introduced the previous ten-cent policy. Migration 007 supersedes it with method-specific minimums and disables new Skrill requests. Apply `database/migrations/007_method_specific_withdrawals.sql` after 006. Migration 008 then disables new PayPal requests; apply `database/migrations/008_disable_paypal_withdrawals.sql` after 007. Migration 009 adds the five native crypto methods at 10 cents and re-enables Skrill at 100 cents before fees; apply it after 008. The authoritative RPC rejects disabled/unknown methods, enforces 10 cents for Revolut and the five native crypto methods and 100 cents for the other four crypto methods and Skrill, and rejects new requests while any requested/reviewing/approved/processing request remains active. Same-key retries return the original request; a key belonging to another user is rejected. Existing requests and settlement accounting are retained.

All tests use an isolated PostgreSQL/PGlite instance; running them never changes a live Supabase database. These forward migrations do not change historical rows.

### Native addresses and manual fees

Native network identities are explicit in method labels and destination hints. Validation checks address **shape**, not ownership, checksum validity or network availability; manual payout operators must verify the recipient/network before sending. No Binance API or automated transfers are added. USD ledger amounts remain integer cents; token quantities and actual Skrill fees are handled during manual payment. The app does not invent a fee schedule or an FX-based net quote.

Address format references: [Conflux Core Space](https://doc.confluxnetwork.org/docs/core/core-space-basics/addresses/), [Ravencoin mainnet parameters](https://github.com/RavenProject/Ravencoin/blob/master/src/chainparams.cpp), [0G mainnet](https://docs.0g.ai/developer-hub/mainnet/mainnet-overview), [IoTeX address formats](https://docs.iotex.io/blockchain/build/reference-docs/native-iotex-development/address-conversion), [Nano address format](https://docs.nano.org/integration-guides/the-basics/).

Skrill operator estimate supplied for this project: approximately CZK 12.55 for amounts up to about USD 50. This is **not** an authoritative tariff or customer-facing net quote. Check the actual fee in Skrill before each manual payment; fees/account conditions and currency conversion can affect it. Reference: [Skrill fees](https://www.skrill.com/cz/siteinformation/fees/).
