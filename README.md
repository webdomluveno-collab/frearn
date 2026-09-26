# Frearn (frearn.online)

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
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Defaults to `support@frearn.online` |

## 4. Local development

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## 5. Database setup

1. Create a Supabase project (Postgres).
2. Run `database/schema.sql` in the SQL editor.
3. Set Supabase env vars, enable RLS policies per your review.
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

## 9. Security considerations before production

- [ ] Legal review of `/privacy` + `/terms` (placeholders marked TODO).
- [ ] Real Supabase Auth (email verification, session, RLS).
- [ ] Admin auth via `ADMIN_EMAILS` + middleware session check (currently deny-by-default).
- [ ] Persistent rate limiting (current `lib/rate-limit.ts` is in-memory placeholder).
- [ ] Callback HMAC verification + idempotency tests; never trust client reward amounts.
- [ ] Raw provider payloads never exposed to users; admin-only.
- [ ] Support email / domain set (`support@frearn.online` — configured).
- [ ] No secrets with `NEXT_PUBLIC_` prefix except anon key + URL.
