#!/usr/bin/env node
/**
 * Explicit staging-only PostgreSQL test for migration 014.
 *
 * Not run automatically: this script performs inserts/deletes in the supplied
 * staging database and briefly creates a test trigger for rollback testing.
 * It requires the separately approved `pg` package; it is intentionally not a
 * project dependency or auto-installed here.
 */

const REQUIRED_CONFIRMATION = "I_UNDERSTAND_STAGING_ONLY";
const PRODUCTION_MARKERS = ["trdawtkflhcuyfrdgywy", "freearn.online"];
const STAGING_PROJECT_REF = "zcjucalejuuxgugwzcuw";
const STAGING_DIRECT_HOST = `db.${STAGING_PROJECT_REF}.supabase.co`;
const STAGING_POOLER_HOST_RE = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;
const TEST_USER_ID = process.env.THEOREMREACH_STAGING_TEST_USER_ID?.trim();
const TEST_TX_ID = process.env.THEOREMREACH_STAGING_TEST_TX_ID ?? "staging-theoremreach-atomic-20261026";
const TRIGGER = "theoremreach_test_fail_atomic_20261026";
const TRIGGER_FUNCTION = "theoremreach_test_fail_atomic_20261026";

function stop(message) {
  console.error(`[theoremreach-staging-test] ${message}`);
  process.exitCode = 2;
}

function validateStagingConnectionString(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "THEOREMREACH_STAGING_DATABASE_URL is not a valid PostgreSQL URL.";
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return "staging connection URL must use postgres:// or postgresql://.";
  }
  if (!parsed.hostname || !parsed.username || !parsed.password) {
    return "staging connection URL must include hostname, username and password.";
  }
  if (parsed.port && parsed.port !== "5432") return "only PostgreSQL port 5432 is accepted.";
  const username = decodeURIComponent(parsed.username);
  const direct = parsed.hostname === STAGING_DIRECT_HOST && username === "postgres";
  const pooler = STAGING_POOLER_HOST_RE.test(parsed.hostname) && username === `postgres.${STAGING_PROJECT_REF}`;
  if (!direct && !pooler) return "connection does not match the verified staging hostname/project username pair.";
  return null;
}

const connectionString = process.env.THEOREMREACH_STAGING_DATABASE_URL;
if (!connectionString) stop("THEOREMREACH_STAGING_DATABASE_URL is required; no connection was attempted.");
if (connectionString && PRODUCTION_MARKERS.some((marker) => connectionString.includes(marker))) {
  stop("refusing a known production URL; use an isolated staging database.");
}
if (connectionString) {
  const connectionError = validateStagingConnectionString(connectionString);
  if (connectionError) stop(`${connectionError} No connection was attempted.`);
}
if (process.env.THEOREMREACH_STAGING_PROJECT_REF !== STAGING_PROJECT_REF) {
  stop(`set THEOREMREACH_STAGING_PROJECT_REF=${STAGING_PROJECT_REF}; no connection was attempted.`);
}
if (!TEST_USER_ID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(TEST_USER_ID)) {
  stop("THEOREMREACH_STAGING_TEST_USER_ID must be an explicit staging profile UUID; no connection was attempted.");
}
if (process.env.THEOREMREACH_STAGING_CONFIRM !== REQUIRED_CONFIRMATION) {
  stop(`set THEOREMREACH_STAGING_CONFIRM=${REQUIRED_CONFIRMATION} to explicitly authorize staging writes.`);
}
if (process.exitCode) process.exit();

let Client;
try {
  ({ Client } = await import("pg"));
} catch {
  stop("the `pg` package is not installed. Install it only after approval; this script did not install anything.");
  process.exit();
}

const clients = [new Client({ connectionString }), new Client({ connectionString })];
const params = [TEST_USER_ID, TEST_TX_ID, 70, 100, JSON.stringify({ test: true, tx_id: TEST_TX_ID })];
let rollbackTriggerInstalled = false;
let connectionsReady = false;
const rollbackTx = `${TEST_TX_ID}-rollback`;

async function setServiceRole(client) {
  await client.query("select set_config('request.jwt.claim.role','service_role',false)");
  const result = await client.query("select auth.role() as role");
  if (result.rows[0]?.role !== "service_role") throw new Error("auth.role() did not resolve to service_role");
}

async function countRows(client) {
  const events = await client.query("select count(*)::int as count from public.provider_events where provider='theoremreach' and external_event_id=$1", [TEST_TX_ID]);
  const ledger = await client.query("select count(*)::int as count from public.ledger_transactions where provider='theoremreach' and provider_transaction_id=$1", [TEST_TX_ID]);
  return { events: events.rows[0].count, ledger: ledger.rows[0].count };
}

async function call(client, txId = TEST_TX_ID) {
  return client.query(
    "select * from public.process_theoremreach_reward($1::uuid,$2::text,$3::int,$4::int,$5::jsonb)",
    [TEST_USER_ID, txId, 70, 100, JSON.stringify({ test: true, tx_id: txId })]
  );
}

async function cleanup() {
  if (!connectionsReady) return;
  try {
    if (rollbackTriggerInstalled) {
      await clients[0].query(`drop trigger if exists ${TRIGGER} on public.ledger_transactions`);
      await clients[0].query(`drop function if exists public.${TRIGGER_FUNCTION}()`);
      rollbackTriggerInstalled = false;
    }
    await clients[0].query("delete from public.ledger_transactions where provider='theoremreach' and provider_transaction_id in ($1,$2)", [TEST_TX_ID, rollbackTx]);
    await clients[0].query("delete from public.provider_events where provider='theoremreach' and external_event_id in ($1,$2)", [TEST_TX_ID, rollbackTx]);
  } catch {
    console.error("[theoremreach-staging-test] cleanup failed; inspect only the dedicated test transaction IDs.");
  }
}

try {
  await Promise.all(clients.map((client) => client.connect()));
  await Promise.all(clients.map(setServiceRole));
  connectionsReady = true;
  const profile = await clients[0].query("select 1 from public.profiles where id=$1::uuid", [TEST_USER_ID]);
  if (profile.rowCount !== 1) throw new Error("dedicated staging fixture profile is missing; no test rows were created");

  await clients[0].query("delete from public.ledger_transactions where provider='theoremreach' and provider_transaction_id=$1", [TEST_TX_ID]);
  await clients[0].query("delete from public.provider_events where provider='theoremreach' and external_event_id=$1", [TEST_TX_ID]);

  const concurrent = await Promise.all(clients.map((client) => call(client)));
  const outcomes = concurrent.map((result) => result.rows[0]?.outcome).sort();
  if (outcomes.join(",") !== "duplicate,rewarded") throw new Error("unexpected concurrent outcomes");
  const afterConcurrent = await countRows(clients[0]);
  if (afterConcurrent.events !== 1 || afterConcurrent.ledger !== 1) throw new Error("concurrent callback produced duplicate rows");

  await clients[0].query(`
    create or replace function public.${TRIGGER_FUNCTION}() returns trigger
    language plpgsql as $$ begin raise exception 'injected rollback failure'; end $$;
  `);
   await clients[0].query(`
     drop trigger if exists ${TRIGGER} on public.ledger_transactions;
     create trigger ${TRIGGER} after insert on public.ledger_transactions
     for each row when (new.provider = 'theoremreach') execute function public.${TRIGGER_FUNCTION}();
   `);
   rollbackTriggerInstalled = true;
  try {
    await call(clients[0], rollbackTx);
    throw new Error("rollback injection unexpectedly succeeded");
  } catch (error) {
    if (!String(error?.message ?? error).includes("injected rollback failure")) throw error;
   } finally {
     await cleanup();
    const event = await clients[0].query("select count(*)::int as count from public.provider_events where provider='theoremreach' and external_event_id=$1", [rollbackTx]);
    const ledger = await clients[0].query("select count(*)::int as count from public.ledger_transactions where provider='theoremreach' and provider_transaction_id=$1", [rollbackTx]);
    if (event.rows[0].count !== 0 || ledger.rows[0].count !== 0) throw new Error("rollback left partial rows");
  }

   console.log("TheoremReach staging atomic test passed: two clients, idempotency, rollback, cleanup.");
} catch (error) {
  stop(`staging test failed: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
  await cleanup();
  await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
}
