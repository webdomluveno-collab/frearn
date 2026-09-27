-- Migration 004: allow one reward + one reversal per provider transaction.
-- Idempotent: safe to run multiple times.
--
-- Background (production incident, Sep 2026): migration 002 created
--   UNIQUE (provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL
-- on ledger_transactions. Reversal rows intentionally carry the SAME
-- (provider, provider_transaction_id) as their original reward (traceability),
-- so every status=2 reversal INSERT raised Postgres 23505. The application maps
-- ANY unique violation to "duplicate" and answered HTTP 200 — a silent no-op:
-- no reversal row, balance unchanged, CPX tooling showed success.
--
-- The per-row idempotency_key (cpx:{trans_id}:reward / cpx:{trans_id}:reversal)
-- already distinguishes reward from reversal. This migration narrows the
-- composite guard to (provider, provider_transaction_id, type) so that:
--   - duplicate rewards still conflict (same type),
--   - duplicate reversals still conflict (same type),
--   - exactly one reward + one reversal may coexist per CPX trans_id.
-- RLS, auth, and all other behavior are untouched.

drop index if exists ledger_transactions_provider_txn_uidx;

create unique index if not exists ledger_transactions_provider_txn_uidx
  on ledger_transactions (provider, provider_transaction_id, type)
  where provider_transaction_id is not null;
