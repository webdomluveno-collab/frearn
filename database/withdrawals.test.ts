import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { METHOD_CASES } from "../lib/withdrawals/__tests__/cases";
import { PAYOUT_RULES } from "../lib/withdrawals";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

// Real PostgreSQL SQL/PLpgSQL, isolated in memory. No live Supabase connection.
// Single-connection engine: locking is additionally pinned in the function definition;
// these tests do not claim a multi-connection concurrency/load test.
const db = new PGlite();
const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
async function request(amount = 10, key = "first", user = UID, method = "revolut") {
  return (await db.query<{ request_id: string; ledger_id: string; is_duplicate: boolean }>(
    "select * from request_withdrawal($1::uuid,$2::int,$3::text,'@someone',$4::text)", [user, amount, method, key]
  )).rows[0];
}
async function settle(id: string, action: string) {
  return (await db.query<{ already: boolean }>("select * from settle_withdrawal($1::uuid,$2::text,'ops@freearn.online')", [id, action])).rows[0];
}
async function available(user = UID) {
  const result = await db.query<{ cents: number }>(`select (
    coalesce(sum(amount_cents) filter (where status='confirmed'),0)
    - coalesce(sum(-amount_cents) filter (where type='withdrawal' and status='pending'),0)
  )::int as cents from ledger_transactions where user_id=$1::uuid`, [user]);
  return result.rows[0].cents;
}
async function credit(cents: number, user = UID) {
  await db.query("insert into ledger_transactions(user_id,type,status,amount_cents,idempotency_key) values ($1::uuid,'survey_reward','confirmed',$2::int,$3)", [user, cents, `reward:${user}`]);
}

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(read("schema.sql"));
  for (const migration of ["002_cpx_provider.sql", "003_defensive_signup_trigger.sql", "004_fix_reversal_unique_index.sql", "005_withdrawals.sql", "006_ten_cent_withdrawals.sql", "007_method_specific_withdrawals.sql", "008_disable_paypal_withdrawals.sql"]) {
    await db.exec(read(`migrations/${migration}`));
  }
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1::uuid,'one@example.com','{\"country\":\"CZ\"}'),($2::uuid,'two@example.com','{\"country\":\"CZ\"}')", [UID, OTHER]);
}, 30000);
afterAll(async () => { await db.close(); });
beforeEach(async () => { await db.exec("truncate withdrawal_requests, ledger_transactions cascade;"); });

describe("forward withdrawal migration: real database enforcement", () => {
  it("rejects $0.09 without creating a hold", async () => {
    await credit(100);
    await expect(request(9)).rejects.toThrow("below_minimum");
    expect(await available()).toBe(100);
    expect((await db.query("select * from withdrawal_requests")).rows).toHaveLength(0);
  });
  it("accepts exactly $0.10 balance, reserving exactly $0.10", async () => {
    await credit(10); const row = await request();
    expect(row.is_duplicate).toBe(false); expect(await available()).toBe(0);
    const hold = (await db.query<{ amount_cents: number; status: string }>("select amount_cents,status from ledger_transactions where id=$1::uuid", [row.ledger_id])).rows[0];
    expect(hold).toEqual({amount_cents:-10,status:"pending"});
  });
  it("rejects insufficient balance atomically", async () => {
    await credit(9); await expect(request()).rejects.toThrow("insufficient_balance");
    expect(await available()).toBe(9);
    expect((await db.query("select * from ledger_transactions where type='withdrawal'")).rows).toHaveLength(0);
  });
  it("same-key retry returns the same request without another hold", async () => {
    await credit(100); const first = await request(); const retry = await request();
    expect(retry).toEqual({...first,is_duplicate:true}); expect(await available()).toBe(90);
    expect((await db.query("select * from withdrawal_requests")).rows).toHaveLength(1);
  });
  it.each(["requested","reviewing","approved","processing"])("rejects a second key while first is %s", async status => {
    await credit(100); const first = await request();
    await db.query("update withdrawal_requests set status=$1 where id=$2::uuid", [status,first.request_id]);
    await expect(request(10,"second")).rejects.toThrow("pending_withdrawal");
    expect(await available()).toBe(90);
    expect((await db.query("select * from withdrawal_requests")).rows).toHaveLength(1);
    expect((await request()).is_duplicate).toBe(true);
  });
  it("another user's active request does not block this user", async () => {
    await credit(100); await credit(10,OTHER); await request();
    expect((await request(10,"other",OTHER)).is_duplicate).toBe(false);
  });
  it("another user's idempotency key cannot disclose their request", async () => {
    await credit(100); await credit(100,OTHER); await request();
    await expect(request(10,"first",OTHER)).rejects.toThrow("invalid_request");
    expect(await available(OTHER)).toBe(100);
  });
  it("mark paid keeps one deduction, repeated settlement is a no-op", async () => {
    await credit(100); const row = await request();
    expect((await settle(row.request_id,"paid")).already).toBe(false);
    expect(await available()).toBe(90);
    expect((await settle(row.request_id,"paid")).already).toBe(true);
    expect(await available()).toBe(90);
    expect((await request(10,"after-paid")).is_duplicate).toBe(false);
    expect(await available()).toBe(80);
  });
  it("reject reverses the hold and restores funds exactly once", async () => {
    await credit(10); const row = await request(); await settle(row.request_id,"rejected");
    expect(await available()).toBe(10);
    expect((await settle(row.request_id,"rejected")).already).toBe(true);
    expect(await available()).toBe(10);
    const markers = (await db.query<{amount_cents:number}>("select amount_cents from ledger_transactions where type='reversal'")).rows;
    expect(markers).toEqual([{amount_cents:0}]);
    expect((await request(10,"after-reject")).is_duplicate).toBe(false);
  });
  it.each(["paid","rejected"])("cannot change terminal %s to the opposite outcome", async action => {
    await credit(100); const row = await request(); await settle(row.request_id,action);
    await expect(settle(row.request_id,action==="paid"?"rejected":"paid")).rejects.toThrow("invalid_transition");
    expect(await available()).toBe(action==="paid"?90:100);
  });
  it.each(METHOD_CASES)("DB: $method rejects one cent below $minimum cents", async ({method,minimum}) => {
    await credit(minimum);
    await expect(request(minimum-1,"below",UID,method)).rejects.toThrow("below_minimum");
    expect(await available()).toBe(minimum);
    expect((await db.query("select * from withdrawal_requests")).rows).toHaveLength(0);
    expect((await db.query("select * from ledger_transactions where type='withdrawal'")).rows).toHaveLength(0);
  });
  it.each(METHOD_CASES)("DB: $method permits exactly $minimum cents; shared rule parity", async ({method,minimum}) => {
    expect(PAYOUT_RULES[method].minimumCents).toBe(minimum);
    await credit(minimum); const row = await request(minimum,"exact",UID,method);
    expect(row.is_duplicate).toBe(false); expect(await available()).toBe(0);
    expect((await db.query("select method,amount_cents from withdrawal_requests where id=$1::uuid",[row.request_id])).rows).toEqual([{method,amount_cents:minimum}]);
    expect((await request(minimum,"exact",UID,method)).is_duplicate).toBe(true);
    expect((await db.query("select * from ledger_transactions where type='withdrawal'")).rows).toHaveLength(1);
  });
  it.each(["paypal","skrill","unknown",null])("DB: rejects disabled/unknown %s", async method => {
    await credit(100);
    await expect(request(100,"disabled",UID,method as string)).rejects.toThrow("invalid_method");
    expect(await available()).toBe(100);
    expect((await db.query("select * from withdrawal_requests")).rows).toHaveLength(0);
  });
  it.each([["skrill","paid"],["skrill","rejected"],["paypal","paid"],["paypal","rejected"]])("historical %s remains readable and admin-settleable: %s", async (method,action) => {
    await credit(100);
    // Create a real historical request using the previous RPC, then upgrade.
    await db.exec(read("migrations/006_ten_cent_withdrawals.sql"));
    let row;
    try { row = await request(10,"historical",UID,method); }
    finally { await db.exec(read("migrations/008_disable_paypal_withdrawals.sql")); }
    expect((await db.query("select method,amount_cents,status from withdrawal_requests where id=$1::uuid",[row!.request_id])).rows).toEqual([{method,amount_cents:10,status:"requested"}]);
    expect((await settle(row!.request_id,action)).already).toBe(false);
    expect((await settle(row!.request_id,action)).already).toBe(true);
    expect(await available()).toBe(action==="paid"?90:100);
    await expect(request(10,"new-disabled",UID,method)).rejects.toThrow("invalid_method");
  });
  it("an existing crypto request below the new minimum can still settle", async () => {
    await credit(10); await db.exec(read("migrations/006_ten_cent_withdrawals.sql"));
    let row;
    try { row = await request(10,"old-crypto",UID,"sol"); }
    finally { await db.exec(read("migrations/008_disable_paypal_withdrawals.sql")); }
    expect(await available()).toBe(0); await settle(row!.request_id,"rejected");
    expect(await available()).toBe(10);
  });
  it("card remains unavailable", async () => {
    await credit(10); await expect(request(10,"card",UID,"card")).rejects.toThrow("invalid_method");
  });
  it("service role has execute; anonymous and authenticated roles do not", async () => {
    for (const signature of ["request_withdrawal(uuid,integer,text,text,text)","settle_withdrawal(uuid,text,text)"]) {
      for (const role of ["anon","authenticated","service_role"]) {
        const result = await db.query<{ allowed:boolean }>("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role,signature]);
        expect(result.rows[0].allowed).toBe(role==="service_role");
      }
    }
  });
  it("RLS retains own-read-only finance policies", async () => {
    const result = await db.query<{cmd:string}>("select cmd from pg_policies where tablename in ('ledger_transactions','withdrawal_requests')");
    expect(result.rows.map(x=>x.cmd)).toEqual(["SELECT","SELECT"]);
    for (const role of ["anon","authenticated"]) {
      await db.exec(`set role ${role}`);
      try { await expect(request()).rejects.toThrow("permission denied"); }
      finally { await db.exec("reset role"); }
    }
  });
  it("SECURITY DEFINER and fixed search_path retain the per-user lock", async () => {
    const result = await db.query<{prosecdef:boolean;proconfig:string[];definition:string}>(`select prosecdef,proconfig,pg_get_functiondef(oid) as definition from pg_proc where proname='request_withdrawal'`);
    expect(result.rows[0].prosecdef).toBe(true);
    expect(result.rows[0].proconfig).toContain("search_path=public");
    expect(result.rows[0].definition).toContain("pg_advisory_xact_lock");
  });
  it("forward migration can be reapplied without changing active requests or balances", async () => {
    await credit(100); const row = await request(); await db.exec(read("migrations/008_disable_paypal_withdrawals.sql"));
    expect(await available()).toBe(90); expect((await request()).request_id).toBe(row.request_id);
    await expect(request(10,"new")).rejects.toThrow("pending_withdrawal");
  });
});
