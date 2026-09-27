# Frearn (freearn.online)

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
3. Set Supabase env vars (URL, anon key, service-role key).
4. Balances are **derived** from `ledger_transactions` (see `lib/wallet/ledger.ts`). Money is integer cents in TS, `NUMERIC`/cents in Postgres — never floats.

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

Frearn's first real survey provider is **CPX Research** (App ID `36592`, site `https://freearn.online`).
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

- `amount_local` is treated as the **authoritative per-user reward** — Frearn
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

## 11. Security considerations before production

- [ ] Legal review of `/privacy` + `/terms` (placeholders marked TODO).
- [x] Real Supabase Auth wired (email verification via `/auth/callback`; enable it in Supabase Auth settings).
- [x] Admin auth via `ADMIN_EMAILS` + middleware session check (deny-by-default 404 kept).
- [x] RLS migration written (`database/migrations/002_cpx_provider.sql`) — **you must apply it**; verify policies in Supabase (see §5).
- [ ] Persistent rate limiting (current `lib/rate-limit.ts` is in-memory placeholder).
- [x] CPX signature verification + idempotency tests implemented — **you must confirm hash formulas/response with CPX docs** (see §9.4 and final checklist below).
- [ ] Raw provider payloads never exposed to users; admin-only.
- [ ] Support email / domain set (`support@freearn.online` — configured).
- [ ] No secrets with `NEXT_PUBLIC_` prefix except anon key + URL.
