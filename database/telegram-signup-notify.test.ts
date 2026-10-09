import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// Real PostgreSQL trigger behavior, isolated in memory. Stubs replace the
// Supabase-only services the migration integrates with:
// - vault.decrypted_secrets (server-side secrets, names only in migration)
// - net.http_post (pg_net async HTTP; records calls instead of sending)
// - auth.users (minimal Supabase Auth shape)
// Dummy secret VALUES below are test-only fixtures, never real credentials.
const db = new PGlite();
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");

const FAKE_TOKEN = "DUMMY-BOT-TOKEN-FOR-TESTS-ONLY";
const FAKE_CHAT = "123456789";

async function calls() {
  return (
    await db.query<{ url: string; headers: unknown; body: { chat_id: string; text: string } }>(
      "select url, headers, body from net.calls order by rowid"
    )
  ).rows;
}

async function signup(email: string, confirmed: boolean, id?: string) {
  const uid = id ?? `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12)
    .toString()
    .padStart(12, "0")}`;
  await db.query(
    "insert into auth.users(id,email,created_at,confirmed_at) values ($1::uuid,$2,$3::timestamptz,$4::timestamptz)",
    [uid, email, "2026-10-09 12:34:56+00", confirmed ? "2026-10-09 12:35:10+00" : null]
  );
  return uid;
}

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), confirmed_at timestamptz);
    create schema vault;
    create table vault.decrypted_secrets(name text primary key, decrypted_secret text);
    create schema net;
    create table net.calls(rowid serial primary key, url text, headers jsonb, body jsonb);
    create table net.cfg(fail boolean); insert into net.cfg values (false);
    create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
      language plpgsql as $$
      begin
        if (select fail from net.cfg) then raise exception 'simulated telegram outage'; end if;
        insert into net.calls(url, headers, body) values (url, headers, body);
        return 1;
      end $$;`);
  await db.exec(read("migrations/010_telegram_signup_notify.sql"));
  await db.query("insert into vault.decrypted_secrets(name,decrypted_secret) values ('telegram_bot_token',$1),('telegram_chat_id',$2)", [
    FAKE_TOKEN,
    FAKE_CHAT,
  ]);
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("telegram signup trigger: real database behavior", () => {
  it("one unconfirmed signup produces exactly one message, never marked confirmed", async () => {
    const before = (await calls()).length;
    const uid = await signup("newbie@example.com", false);
    expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
    const after = await calls();
    expect(after).toHaveLength(before + 1);
    const body = after[after.length - 1].body;
    expect(body.chat_id).toBe(FAKE_CHAT);
    expect(body.text).toContain("🎉 New Freearn registration!");
    expect(body.text).toContain("👤 A new user has signed up");
    expect(body.text).toContain("📅 2026-10-09 12:34 UTC");
    expect(body.text).toContain("not confirmed yet");
    expect(body.text).not.toContain("confirmed: Yes");
    expect(body.text).not.toContain("newbie@example.com");
  });

  it("confirmed signup is reported honestly as confirmed", async () => {
    const before = (await calls()).length;
    await signup("verified@example.com", true);
    const after = await calls();
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1].body.text).toContain("Email confirmed: Yes");
  });

  it("request targets the Telegram Bot API with JSON content type, token only in URL", async () => {
    const before = (await calls()).length;
    await signup("api@example.com", false);
    const after = await calls();
    const last = after[after.length - 1];
    expect(last.url).toBe(`https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`);
    expect(last.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("missing vault secrets: silent no-op, signup unaffected", async () => {
    await db.exec("delete from vault.decrypted_secrets");
    const before = (await calls()).length;
    try {
      const uid = await signup("nosecrets@example.com", false);
      expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
      expect(await calls()).toHaveLength(before);
    } finally {
      await db.query("insert into vault.decrypted_secrets(name,decrypted_secret) values ('telegram_bot_token',$1),('telegram_chat_id',$2)", [
        FAKE_TOKEN,
        FAKE_CHAT,
      ]);
    }
  });

  it("telegram outage cannot break signup", async () => {
    await db.exec("update net.cfg set fail=true");
    const before = (await calls()).length;
    try {
      const uid = await signup("outage@example.com", false);
      // The auth row exists despite the failed HTTP call: registration won.
      expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
      expect(await calls()).toHaveLength(before);
    } finally {
      await db.exec("update net.cfg set fail=false");
    }
  });

  it("re-login/update and re-signup produce no extra messages", async () => {
    const uid = await signup("repeat@example.com", false);
    const before = (await calls()).length;
    // Confirmation and profile edits are UPDATEs: trigger is INSERT-only.
    await db.query("update auth.users set confirmed_at=now() where id=$1::uuid", [uid]);
    await db.query("update auth.users set email='repeat2@example.com' where id=$1::uuid", [uid]);
    expect(await calls()).toHaveLength(before);
  });

  it("migration is re-runnable without duplicate triggers", async () => {
    await db.exec(read("migrations/010_telegram_signup_notify.sql"));
    const before = (await calls()).length;
    await signup("rerun@example.com", false);
    expect(await calls()).toHaveLength(before + 1);
    const triggers = (
      await db.query("select count(*)::int as n from pg_trigger where tgname='on_auth_user_telegram_notify'")
    ).rows[0] as { n: number };
    expect(triggers.n).toBe(1);
  });
});

describe("migration 010 contains no secrets and is fail-safe by construction", () => {
  const sql = read("migrations/010_telegram_signup_notify.sql");

  it("references Vault secret names only, never secret values", () => {
    expect(sql).toContain("'telegram_bot_token'");
    expect(sql).toContain("'telegram_chat_id'");
    // No Telegram-style token literal (digits + colon + long secret part).
    expect(sql).not.toMatch(/bot[0-9]{5,}:[A-Za-z0-9_-]{10,}/);
  });

  it("fires exactly once per new auth row and never blocks it", () => {
    expect(sql).toMatch(/after insert on auth\.users/i);
    expect(sql).toMatch(/for each row/i);
    expect(sql).toMatch(/exception\s+when others/i);
    expect(sql).toMatch(/return new/i);
    expect(sql).toMatch(/drop trigger if exists on_auth_user_telegram_notify/i);
  });

  it("direct execution is revoked; trigger firing needs no grants", () => {
    expect(sql).toMatch(/revoke all on function public\.notify_telegram_signup\(\)/i);
  });

  it("message marks confirmation honestly and carries no PII or stats", () => {
    expect(sql).toContain("🎉 New Freearn registration!");
    expect(sql).toContain("👤 A new user has signed up");
    expect(sql).toContain("confirmed_at");
    expect(sql).toContain("not confirmed yet");
    expect(sql).not.toMatch(/password|user_count|total_payout|testimonial/i);
  });
});
