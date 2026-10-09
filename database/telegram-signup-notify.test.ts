import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  buildCanonical,
  buildMessage,
  formatUtcMinute,
  hmacSha256Hex,
  isFreshTimestamp,
  parsePayload,
  timingSafeEqualHex,
  verifySignature,
} from "../supabase/functions/_shared/verify";

// Real PostgreSQL trigger behavior, isolated in memory. Stubs replace the
// Supabase-only services the migration integrates with:
// - vault.decrypted_secrets (signing secret + function URL, names only)
// - net.http_post (pg_net async HTTP; records calls instead of sending)
// - auth.users (minimal Supabase Auth shape)
// Signing values below are test-only fixtures, never real credentials.
const db = new PGlite();
const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");

const SIGNING_SECRET = "TEST-SIGNING-SECRET-abc123-not-real";
const FUNCTION_URL = "https://functions.test.local/notify-signup";

interface CapturedCall {
  url: string;
  headers: Record<string, string>;
  body: {
    user_id: string;
    created_minute: string;
    email_confirmed: boolean;
    nonce: string;
    ts: number;
  };
}

async function calls(): Promise<CapturedCall[]> {
  return (
    await db.query<{ url: string; headers: Record<string, string>; body: CapturedCall["body"] }>(
      "select url, headers, body from net.calls order by rowid"
    )
  ).rows as CapturedCall[];
}

async function signup(email: string, confirmed: boolean) {
  const uid = `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12)
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
        if (select fail from net.cfg) then raise exception 'simulated edge outage'; end if;
        insert into net.calls(url, headers, body) values (url, headers, body);
        return 1;
      end $$;`);
  await db.exec(read("migrations/010_telegram_signup_notify.sql"));
  await db.query(
    "insert into vault.decrypted_secrets(name,decrypted_secret) values ('notify_signing_secret',$1),('notify_function_url',$2)",
    [SIGNING_SECRET, FUNCTION_URL]
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("telegram_hmac_sha256_hex: standards compliance", () => {
  it("matches RFC 4231 test vector (20x 0x0b key, 'Hi There')", async () => {
    // Cross-checked against Node crypto AND Python hashlib (three independent
    // implementations must agree — a hardcoded memory of the vector is not trusted).
    const rows = (
      await db.query<{ h: string }>(
        "select public.telegram_hmac_sha256_hex(repeat(chr(11),20),'Hi There') as h"
      )
    ).rows;
    expect(rows[0].h).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  });

  it("agrees with Node crypto for short, long, and block-size keys", async () => {
    for (const [key, data] of [
      ["short-key", "v1.1728473690.user.minute.0.nonce"],
      ["x".repeat(64), "block-size key"],
      ["y".repeat(100), "longer-than-block key gets hashed first"],
    ]) {
      const expected = createHmac("sha256", key).update(data).digest("hex");
      const rows = (
        await db.query<{ h: string }>("select public.telegram_hmac_sha256_hex($1,$2) as h", [
          key,
          data,
        ])
      ).rows;
      expect(rows[0].h).toBe(expected);
    }
  });
});

describe("telegram signup trigger: real database behavior", () => {
  it("unconfirmed signup relays one signed event; confirmation stays honest", async () => {
    const before = (await calls()).length;
    const uid = await signup("newbie@example.com", false);
    expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
    const after = await calls();
    expect(after).toHaveLength(before + 1);
    const call = after[after.length - 1];
    expect(call.url).toBe(FUNCTION_URL);
    expect(call.headers["Content-Type"]).toBe("application/json");
    expect(call.body.user_id).toBe(uid);
    expect(call.body.created_minute).toBe("2026-10-09 12:34");
    expect(call.body.email_confirmed).toBe(false);
    expect(call.body.ts).toBeGreaterThan(0);
    // No Telegram credential or destination anywhere in the relayed request.
    expect(JSON.stringify(call)).not.toContain("TELEGRAM");
    expect(call.url).not.toMatch(/bot[0-9]+:/);
  });

  it("confirmed signup reports email_confirmed true", async () => {
    const before = (await calls()).length;
    await signup("verified@example.com", true);
    const after = await calls();
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1].body.email_confirmed).toBe(true);
  });

  it("SQL signature verifies with the shared TypeScript verifier (cross-runtime agreement)", async () => {
    const before = (await calls()).length;
    await signup("agree@example.com", false);
    const call = (await calls())[before];
    const sigHeader = call.headers["X-Signature"] as string;
    const tsHeader = call.headers["X-Timestamp"] as string;
    expect(sigHeader).toMatch(/^v1=[0-9a-f]{64}$/);
    // Rebuild the canonical string exactly as both sides specify it.
    const canonical = `v1.${call.body.ts}.${call.body.user_id}.${call.body.created_minute}.0.${call.body.nonce}`;
    expect(canonical).toBe(
      buildCanonical({
        ts: call.body.ts,
        userId: call.body.user_id,
        createdMinute: call.body.created_minute,
        confirmed: false,
        nonce: call.body.nonce,
      })
    );
    expect(Number(tsHeader)).toBe(call.body.ts);
    const ok = await verifySignature(SIGNING_SECRET, sigHeader, {
      user_id: call.body.user_id,
      created_minute: call.body.created_minute,
      email_confirmed: false,
      nonce: call.body.nonce,
      ts: call.body.ts,
    });
    expect(ok).toBe(true);
    // Tampering with any signed field breaks verification.
    const tampered = await verifySignature(SIGNING_SECRET, sigHeader, {
      user_id: call.body.user_id,
      created_minute: call.body.created_minute,
      email_confirmed: true,
      nonce: call.body.nonce,
      ts: call.body.ts,
    });
    expect(tampered).toBe(false);
  });

  it("each event carries a fresh nonce (replay-distinct)", async () => {
    const before = await calls();
    await signup("nonce-a@example.com", false);
    await signup("nonce-b@example.com", false);
    const after = await calls();
    const nonces = after.slice(before.length).map((c) => c.body.nonce);
    expect(new Set(nonces).size).toBe(2);
  });

  it("missing vault entries: silent no-op, signup unaffected", async () => {
    await db.exec("delete from vault.decrypted_secrets");
    const before = (await calls()).length;
    try {
      const uid = await signup("nosecrets@example.com", false);
      expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
      expect(await calls()).toHaveLength(before);
    } finally {
      await db.query(
        "insert into vault.decrypted_secrets(name,decrypted_secret) values ('notify_signing_secret',$1),('notify_function_url',$2)",
        [SIGNING_SECRET, FUNCTION_URL]
      );
    }
  });

  it("edge outage cannot break signup", async () => {
    await db.exec("update net.cfg set fail=true");
    const before = (await calls()).length;
    try {
      const uid = await signup("outage@example.com", false);
      expect(((await db.query("select 1 from auth.users where id=$1::uuid", [uid])).rows)).toHaveLength(1);
      expect(await calls()).toHaveLength(before);
    } finally {
      await db.exec("update net.cfg set fail=false");
    }
  });

  it("updates and re-application produce no extra events", async () => {
    const uid = await signup("repeat@example.com", false);
    const before = (await calls()).length;
    await db.query("update auth.users set confirmed_at=now() where id=$1::uuid", [uid]);
    await db.query("update auth.users set email='repeat2@example.com' where id=$1::uuid", [uid]);
    await db.exec(read("migrations/010_telegram_signup_notify.sql"));
    expect(await calls()).toHaveLength(before);
    const triggers = (
      await db.query("select count(*)::int as n from pg_trigger where tgname='on_auth_user_telegram_notify'")
    ).rows[0] as { n: number };
    expect(triggers.n).toBe(1);
    const tables = (
      await db.query("select count(*)::int as n from pg_tables where tablename='telegram_notify_nonces'")
    ).rows[0] as { n: number };
    expect(tables.n).toBe(1);
  });
});

describe("shared verify.ts unit behavior", () => {
  it("builds the exact canonical string", () => {
    expect(
      buildCanonical({ ts: 1728473690, userId: "u-1", createdMinute: "2026-10-09 12:34", confirmed: false, nonce: "n-1" })
    ).toBe("v1.1728473690.u-1.2026-10-09 12:34.0.n-1");
  });

  it("hmacSha256Hex matches Node crypto", async () => {
    expect(await hmacSha256Hex("key", "The quick brown fox")).toBe(
      createHmac("sha256", "key").update("The quick brown fox").digest("hex")
    );
  });

  it("timingSafeEqualHex compares strictly", () => {
    expect(timingSafeEqualHex("ab12", "ab12")).toBe(true);
    expect(timingSafeEqualHex("ab12", "ab13")).toBe(false);
    expect(timingSafeEqualHex("ab12", "ab123")).toBe(false);
  });

  it("accepts ±300s timestamps, rejects stale/future/malformed", () => {
    expect(isFreshTimestamp(1000, 1300)).toBe(true);
    expect(isFreshTimestamp(1000, 700)).toBe(true);
    expect(isFreshTimestamp(1000, 1301)).toBe(false);
    expect(isFreshTimestamp(1000, 699)).toBe(false);
    expect(isFreshTimestamp("1000", 1000)).toBe(false);
    expect(isFreshTimestamp(10.5, 10)).toBe(false);
  });

  it("parsePayload rejects malformed bodies", () => {
    expect(parsePayload(null)).toBe(null);
    expect(parsePayload({})).toBe(null);
    expect(
      parsePayload({ user_id: "not-a-uuid", created_minute: "2026-10-09 12:34", email_confirmed: false, nonce: "n", ts: 1 })
    ).toBe(null);
    expect(
      parsePayload({
        user_id: "00000000-0000-4000-8000-000000000001",
        created_minute: "2026-10-09 12:34",
        email_confirmed: false,
        nonce: "not-a-uuid",
        ts: 1,
      })
    ).toBe(null);
  });

  it("verifySignature rejects wrong secret, bad header, and empty secret", async () => {
    const payload = {
      user_id: "00000000-0000-4000-8000-000000000001",
      created_minute: "2026-10-09 12:34",
      email_confirmed: false,
      nonce: "00000000-0000-4000-8000-000000000002",
      ts: 1728473690,
    };
    const good = `v1=${await hmacSha256Hex("s3cr3t", buildCanonical({ ...payload, userId: payload.user_id, createdMinute: payload.created_minute, confirmed: payload.email_confirmed }))}`;
    expect(await verifySignature("s3cr3t", good, payload)).toBe(true);
    expect(await verifySignature("wrong", good, payload)).toBe(false);
    expect(await verifySignature("", good, payload)).toBe(false);
    expect(await verifySignature("s3cr3t", "garbage", payload)).toBe(false);
    expect(await verifySignature("s3cr3t", good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"), payload)).toBe(false);
  });

  it("message format is exact and honest in both states", () => {
    expect(buildMessage({ createdMinute: "2026-10-09 12:34", emailConfirmed: false })).toBe(
      "🎉 New Freearn registration!\n👤 A new user has signed up\n📅 2026-10-09 12:34 UTC\n✉️ Email confirmed: No — not confirmed yet"
    );
    expect(buildMessage({ createdMinute: "2026-10-09 12:34", emailConfirmed: true })).toBe(
      "🎉 New Freearn registration!\n👤 A new user has signed up\n📅 2026-10-09 12:34 UTC\n✉️ Email confirmed: Yes"
    );
    expect(formatUtcMinute("2026-10-09T12:34:56.000Z")).toBe("2026-10-09 12:34");
  });
});

describe("migration 010 + edge source contain no secrets and stay fail-safe", () => {
  const sql = read("migrations/010_telegram_signup_notify.sql");
  const edge = read("../supabase/functions/notify-signup/index.ts");

  it("references Vault names only, never secret values", () => {
    expect(sql).toContain("'notify_signing_secret'");
    expect(sql).toContain("'notify_function_url'");
    expect(sql).not.toMatch(/bot[0-9]{5,}:[A-Za-z0-9_-]{10,}/);
  });

  it("fires exactly once per new auth row and never blocks it", () => {
    expect(sql).toMatch(/after insert on auth\.users/i);
    expect(sql).toMatch(/for each row/i);
    expect(sql).toMatch(/exception\s+when others/i);
    expect(sql).toMatch(/return new/i);
    expect(sql).toMatch(/drop trigger if exists on_auth_user_telegram_notify/i);
  });

  it("direct execution is revoked; replay table is deny-by-default", () => {
    expect(sql).toMatch(/revoke all on function public\.notify_telegram_signup\(\)/i);
    expect(sql).toMatch(/revoke all on function public\.telegram_hmac_sha256_hex/i);
    expect(sql).toMatch(/enable row level security/i);
  });

  it("edge function reads all credentials from env, hardcodes none", () => {
    for (const name of ["NOTIFY_SIGNING_SECRET", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
      expect(edge).toContain(`Deno.env.get("${name}")`);
    }
    expect(edge).not.toMatch(/bot[0-9]{5,}:[A-Za-z0-9_-]{10,}/);
    expect(edge).toMatch(/bot\$\{botToken\}\/sendMessage/);
  });

  it("edge enforces signature, freshness, and nonce uniqueness", () => {
    expect(edge).toContain("X-Signature");
    expect(edge).toContain("X-Timestamp");
    expect(edge).toContain("telegram_notify_nonces");
    expect(edge).toContain("no-store");
  });
});
