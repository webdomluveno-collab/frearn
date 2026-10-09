import {
  buildMessage,
  isFreshTimestamp,
  parsePayload,
  verifySignature,
} from "../_shared/verify.ts";

/**
 * POST /notify-signup — Telegram relay for new Supabase Auth users.
 *
 * Trust model: the ONLY authentication is the time-limited HMAC signature
 * produced by the database trigger (migration 010) with the shared Vault
 * secret. There is deliberately NO static bearer token or API key on this
 * endpoint — nothing transmitted can be replayed after ±5 minutes, and each
 * nonce is accepted exactly once (unique constraint).
 *
 * Server secrets (Supabase Dashboard -> Edge Functions -> Secrets, or
 * `supabase secrets set`; NEVER in repo/SQL/client):
 *   NOTIFY_SIGNING_SECRET — same value as Vault `notify_signing_secret`
 *   TELEGRAM_BOT_TOKEN    — from @BotFather
 *   TELEGRAM_CHAT_ID      — private chat id
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
 *
 * Deploy WITHOUT JWT verification (the HMAC *is* the auth):
 *   supabase functions deploy notify-signup --no-verify-jwt
 */

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function supabaseFetch(path: string, init: RequestInit, serviceKey: string, baseUrl: string) {
  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const signingSecret = Deno.env.get("NOTIFY_SIGNING_SECRET") ?? "";
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!signingSecret || !botToken || !chatId || !supabaseUrl || !serviceKey) {
    console.error("[notify-signup] misconfigured: required secret missing");
    return json(500, { error: "misconfigured" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const payload = parsePayload(body);
  if (!payload) return json(400, { error: "invalid_shape" });

  const tsHeader = req.headers.get("X-Timestamp");
  const ts = tsHeader !== null && /^-?\d+$/.test(tsHeader.trim()) ? Number(tsHeader.trim()) : NaN;
  if (!Number.isInteger(ts) || !isFreshTimestamp(ts, Math.floor(Date.now() / 1000))) {
    return json(401, { error: "stale_or_missing_timestamp" });
  }
  if (ts !== payload.ts) return json(401, { error: "timestamp_mismatch" });

  const signatureHeader = req.headers.get("X-Signature");
  if (!(await verifySignature(signingSecret, signatureHeader, payload))) {
    return json(401, { error: "bad_signature" });
  }

  // Replay protection: nonce accepted exactly once (unique constraint).
  // Opportunistically purge expired nonces; failures here never block the event.
  try {
    const insert = await supabaseFetch(
      "telegram_notify_nonces",
      { method: "POST", body: JSON.stringify({ nonce: payload.nonce }) },
      serviceKey,
      supabaseUrl
    );
    if (insert.status === 409) return json(200, { ok: true, duplicate: true });
    if (!insert.ok) throw new Error(`nonce store responded ${insert.status}`);
    await supabaseFetch(
      `telegram_notify_nonces?created_at=lt.${encodeURIComponent(
        new Date(Date.now() - 15 * 60 * 1000).toISOString()
      )}`,
      { method: "DELETE" },
      serviceKey,
      supabaseUrl
    ).catch(() => undefined);
  } catch {
    return json(500, { error: "nonce_store_unavailable" });
  }

  const text = buildMessage({ createdMinute: payload.created_minute, emailConfirmed: payload.email_confirmed });
  let tg: Response;
  try {
    tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    console.error("[notify-signup] telegram transport failed");
    return json(502, { error: "telegram_unreachable" });
  }
  if (!tg.ok) {
    console.error(`[notify-signup] telegram rejected request (${tg.status})`);
    return json(502, { error: "telegram_rejected" });
  }
  return json(200, { ok: true });
});
