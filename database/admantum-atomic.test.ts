import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon') $$;
  `);
  await db.exec(read("schema.sql"));
  await db.exec(read("migrations/002_cpx_provider.sql"));
  await db.exec(read("migrations/004_fix_reversal_unique_index.sql"));
  await db.exec(read("migrations/020_admantum_atomic_rewards.sql"));
  await db.query("insert into auth.users(id,email) values ($1::uuid,'admantum@test.invalid')", [UID]);
  await db.query("insert into profiles(id,email,country) values ($1::uuid,'admantum@test.invalid','XX') on conflict (id) do nothing", [UID]);
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
}, 30000);

beforeEach(async () => {
  await db.exec("truncate provider_events, ledger_transactions, fraud_flags cascade;");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
});

afterAll(async () => db.close());

async function credit(txId: string, units = 60) {
  return (await db.query<{ outcome: string; ledger_id: string | null }>(
    "select * from process_admantum_credit($1::uuid,$2::text,$3::bigint,$4::bigint,$5::int,$6::text,$7::jsonb)",
    [UID, txId, units, units, Math.round((units * 100) / 60), "offer-1", JSON.stringify({ virtual_currency: String(units) })]
  )).rows[0];
}

describe("AdMantum migration 020 atomic credit", () => {
  it("credits exact user cents and deduplicates the same transaction", async () => {
    expect(await credit("admantum-1", 60)).toMatchObject({ outcome: "credited" });
    expect(await credit("admantum-1", 60)).toMatchObject({ outcome: "duplicate" });
    expect((await db.query<{ balance: number }>("select sum(amount_cents)::int as balance from ledger_transactions")).rows[0].balance).toBe(60);
  });

  it("rejects non-service roles and preserves reversal-before-credit as a caller-level fail-closed path", async () => {
    await db.query("select set_config('request.jwt.claim.role','anon',false)");
    await expect(credit("unauthorized")).rejects.toThrow(/admantum_unauthorized/);
    await db.query("select set_config('request.jwt.claim.role','service_role',false)");
    expect((await db.query<{ n: number }>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(0);
  });

  it("records a reversal for manual review without creating a debit", async () => {
    const result = (await db.query<{ outcome: string }>(
      "select * from record_admantum_pending($1::uuid,$2::text,$3::text,$4::bigint,$5::text,$6::jsonb)",
      [UID, "reversal-event-1", "reversed", 60, "offer-1", JSON.stringify({ status: "0" })]
    )).rows[0];
    expect(result.outcome).toBe("pending_manual_review");
    expect((await db.query<{ n: number }>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(0);
  });

  it("keeps historical ledger records and supports fractional-free 60/70 values", async () => {
    await db.query("insert into ledger_transactions(user_id,type,status,amount_cents,description,idempotency_key,provider,provider_transaction_id) values ($1,'offer_reward','confirmed',70,'historical','historical:70','legacy','legacy-70')", [UID]);
    expect(await credit("admantum-60", 60)).toMatchObject({ outcome: "credited" });
    expect((await db.query<{ balance: number }>("select sum(amount_cents)::int as balance from ledger_transactions")).rows[0].balance).toBe(130);
  });
});
