import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

async function callReward(txId = "tr-1", entryTransactionId: string | null = "entry-1") {
  return (await db.query<{ outcome: string; ledger_id: string | null }>(
    "select * from process_theoremreach_reward($1::uuid,$2::text,$3::int,$4::int,$5::jsonb)",
    [
      UID,
      txId,
      70,
      100,
      JSON.stringify({ tx_id: txId, transaction_id: entryTransactionId, reward: "70", currency: "1.00" }),
    ]
  )).rows[0];
}

async function callReversal(eventId: string, txId: string) {
  return (await db.query<{ outcome: string; ledger_id: string | null }>(
    "select * from process_theoremreach_reversal($1::text,$2::uuid,$3::text,$4::jsonb)",
    [
      eventId,
      UID,
      txId,
      // amount_in_currency is deliberately misleading: the RPC must use the
      // original ledger amount, not the webhook amount.
      JSON.stringify({ tx_id: txId, amount_in_currency: "999.99", event_type: "reversal" }),
    ]
  )).rows[0];
}

async function callBan(eventId: string, reason = "violation of terms") {
  return (await db.query<{ outcome: string }>(
    "select * from process_theoremreach_ban($1::text,$2::uuid,$3::text,$4::jsonb)",
    [eventId, UID, reason, JSON.stringify({ event_type: "ban", reason })]
  )).rows[0];
}

async function balanceCents() {
  return (await db.query<{ balance: number }>(
    "select coalesce(sum(amount_cents),0)::int as balance from ledger_transactions"
  )).rows[0].balance;
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
  await db.exec(read("migrations/018_theoremreach_event_webhook.sql"));
  await db.query("insert into auth.users(id,email) values ($1::uuid,'atomic@test.invalid')", [UID]);
  await db.query("insert into profiles(id,email,country) values ($1::uuid,'atomic@test.invalid','XX') on conflict (id) do nothing", [UID]);
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
}, 30000);

beforeEach(async () => {
  await db.exec("truncate provider_events, ledger_transactions, fraud_flags cascade;");
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

  it("deduplicates by provider tx_id, never by the optional entry transaction_id", async () => {
    expect(await callReward("tr-provider-1", "entry-1")).toMatchObject({ outcome: "rewarded" });
    expect(await callReward("tr-provider-1", "entry-2")).toMatchObject({ outcome: "duplicate" });
    expect(await callReward("tr-provider-2", "entry-1")).toMatchObject({ outcome: "rewarded" });

    expect((await db.query<{n: number}>("select count(*)::int as n from ledger_transactions")).rows[0].n).toBe(2);
    expect(await balanceCents()).toBe(140);
    const storedEntry = (await db.query<{ entry: string }>(
      "select raw_payload->>'transaction_id' as entry from provider_events where external_event_id = 'tr-provider-1'"
    )).rows[0];
    expect(storedEntry.entry).toBe("entry-1");
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

  it("reverses a credited reward once using the original ledger amount", async () => {
    expect(await callReward("tr-rev")).toMatchObject({ outcome: "rewarded" });
    expect(await callReversal("evt-rev-1", "tr-rev")).toMatchObject({ outcome: "reversed" });
    expect(await callReversal("evt-rev-1", "tr-rev")).toMatchObject({ outcome: "duplicate" });
    expect(await callReversal("evt-rev-2", "tr-rev")).toMatchObject({ outcome: "duplicate" });
    expect(await balanceCents()).toBe(0);
    expect((await db.query<{n: number}>(
      "select count(*)::int as n from ledger_transactions where type = 'reversal' and amount_cents = -70"
    )).rows[0].n).toBe(1);
  });

  it("records a reversal that arrives first and blocks the later reward", async () => {
    expect(await callReversal("evt-late", "tr-late")).toMatchObject({ outcome: "orphan_reversal" });
    expect(await callReward("tr-late")).toMatchObject({ outcome: "reversal_pending", ledger_id: null });
    expect(await balanceCents()).toBe(0);
    expect((await db.query<{n: number}>(
      "select count(*)::int as n from ledger_transactions where type = 'survey_reward'"
    )).rows[0].n).toBe(0);
    expect((await db.query<{status: string}>(
      "select processing_status as status from provider_events where external_event_id = 'reversal:evt-late:tr-late'"
    )).rows[0].status).toBe("reversal_pending");
  });

  it("never leaves a credit without its reversal under concurrent reward/reversal", async () => {
    const [reward, reversal] = await Promise.all([
      callReward("tr-concurrent"),
      callReversal("evt-concurrent", "tr-concurrent"),
    ]);
    expect(["rewarded", "reversal_pending"]).toContain(reward.outcome);
    expect(["reversed", "orphan_reversal"]).toContain(reversal.outcome);
    expect(await balanceCents()).toBe(0);
  });

  it("records ban events idempotently and raises one high-severity fraud flag", async () => {
    expect(await callBan("evt-ban")).toMatchObject({ outcome: "banned" });
    expect(await callBan("evt-ban")).toMatchObject({ outcome: "duplicate" });
    expect((await db.query<{n: number}>("select count(*)::int as n from fraud_flags where severity = 'high'")).rows[0].n).toBe(1);
    expect(await balanceCents()).toBe(0);
  });

  it("rejects non-service-role reversal and ban calls without writes", async () => {
    await db.query("select set_config('request.jwt.claim.role','anon',false)");
    await expect(callReversal("evt-auth", "tr-auth")).rejects.toThrow("theoremreach_unauthorized");
    await expect(callBan("evt-auth-ban")).rejects.toThrow("theoremreach_unauthorized");
    expect((await db.query<{n: number}>("select count(*)::int as n from provider_events")).rows[0].n).toBe(0);
    expect((await db.query<{n: number}>("select count(*)::int as n from fraud_flags")).rows[0].n).toBe(0);
  });
});
