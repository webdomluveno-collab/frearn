import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

async function callReward(txId = "tr-1") {
  return (await db.query<{ outcome: string; ledger_id: string }>(
    "select * from process_theoremreach_reward($1::uuid,$2::text,$3::int,$4::int,$5::jsonb)",
    [UID, txId, 70, 100, JSON.stringify({ tx_id: txId, reward: "70", currency: "1.00" })]
  )).rows[0];
}

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
  await db.exec(read("migrations/014_theoremreach_atomic_reward.sql"));
  await db.query("insert into auth.users(id,email) values ($1::uuid,'atomic@test.invalid')", [UID]);
  await db.query("insert into profiles(id,email,country) values ($1::uuid,'atomic@test.invalid','XX') on conflict (id) do nothing", [UID]);
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
}, 30000);

beforeEach(async () => {
  await db.exec("truncate provider_events, ledger_transactions cascade;");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
});

afterAll(async () => db.close());

describe("TheoremReach atomic RPC — real PostgreSQL-compatible PGlite", () => {
  it("writes one event and one ledger reward atomically and deduplicates retries", async () => {
    expect(await callReward()).toMatchObject({ outcome: "rewarded" });
    expect(await callReward()).toMatchObject({ outcome: "duplicate" });
    expect((await db.query<{n: number}>("select count(*)::int as n from provider_events")).rows[0].n).toBe(1);
    expect((await db.query<{n: number}>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(1);
  });

  it("serializes Promise.all retries in the single PGlite engine without duplicates", async () => {
    const results = await Promise.all([callReward("tr-race"), callReward("tr-race")]);
    expect(results.map(row => row.outcome).sort()).toEqual(["duplicate", "rewarded"]);
    expect((await db.query<{n: number}>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(1);
  });

  it("rolls back the event when the ledger statement fails", async () => {
    await db.exec(`create function test_theoremreach_ledger_failure() returns trigger language plpgsql as $$ begin raise exception 'injected ledger failure'; end $$;`);
    await db.exec("create trigger test_theoremreach_ledger_failure before insert on ledger_transactions for each row when (new.provider = 'theoremreach') execute function test_theoremreach_ledger_failure();");
    await expect(callReward("tr-rollback")).rejects.toThrow("injected ledger failure");
    expect((await db.query<{n: number}>("select count(*)::int as n from provider_events")).rows[0].n).toBe(0);
    expect((await db.query<{n: number}>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(0);
    await db.exec("drop trigger test_theoremreach_ledger_failure on ledger_transactions; drop function test_theoremreach_ledger_failure();");
  });

  it("rejects non-service-role callers without writing anything", async () => {
    await db.query("select set_config('request.jwt.claim.role','anon',false)");
    await expect(callReward("tr-auth")).rejects.toThrow("theoremreach_unauthorized");
    expect((await db.query<{n: number}>("select count(*)::int as n from provider_events")).rows[0].n).toBe(0);
    expect((await db.query<{n: number}>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(0);
  });

  it("rejects an unknown user atomically", async () => {
    await expect(db.query(
      "select * from process_theoremreach_reward($1::uuid,$2::text,$3::int,$4::int,$5::jsonb)",
      ["bbbbbbbb-cccc-dddd-eeee-ffffffffffff", "tr-unknown", 70, 100, "{}"]
    )).rejects.toThrow("theoremreach_unknown_user");
    expect((await db.query<{n: number}>("select count(*)::int as n from provider_events")).rows[0].n).toBe(0);
  });
});
