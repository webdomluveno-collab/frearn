/**
 * Shared Telegram notify-signup verification core.
 *
 * Dependency-free on purpose: imported by the Deno Edge Function
 * (`supabase/functions/notify-signup/index.ts`) AND unit-tested here with
 * vitest. Uses only Web Platform APIs (`crypto.subtle`, `TextEncoder`).
 *
 * Contract (mirrors database/migrations/010_telegram_signup_notify.sql):
 * - canonical string: `v1.<ts>.<user_id>.<created_minute>.<0|1>.<nonce>`
 * - signature header: `v1=<64 lowercase hex HMAC-SHA256>`
 * - timestamp header: unix seconds, accepted within ±300 s
 * - nonce: fresh UUID per event, enforced unique server-side (replay-safe)
 */

export const SIGNATURE_VERSION = "v1";
export const TIMESTAMP_TOLERANCE_SECONDS = 300;

export interface NotifyPayload {
  user_id: string;
  created_minute: string;
  email_confirmed: boolean;
  nonce: string;
  ts: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

export function buildCanonical(p: {
  ts: number;
  userId: string;
  createdMinute: string;
  confirmed: boolean;
  nonce: string;
}): string {
  return `${SIGNATURE_VERSION}.${Math.trunc(p.ts)}.${p.userId}.${p.createdMinute}.${p.confirmed ? "1" : "0"}.${p.nonce}`;
}

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time hex comparison (length check first; lengths are not secret). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseSignatureHeader(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^v1=([0-9a-fA-F]{64})$/);
  return m ? m[1].toLowerCase() : null;
}

export function isFreshTimestamp(ts: unknown, nowSec: number): boolean {
  if (typeof ts !== "number" || !Number.isInteger(ts)) return false;
  return Math.abs(nowSec - ts) <= TIMESTAMP_TOLERANCE_SECONDS;
}

export function parsePayload(body: unknown): NotifyPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.user_id !== "string" || !UUID_RE.test(b.user_id)) return null;
  if (typeof b.created_minute !== "string" || !MINUTE_RE.test(b.created_minute)) return null;
  if (typeof b.email_confirmed !== "boolean") return null;
  if (typeof b.nonce !== "string" || !UUID_RE.test(b.nonce)) return null;
  if (typeof b.ts !== "number" || !Number.isInteger(b.ts)) return null;
  return {
    user_id: b.user_id,
    created_minute: b.created_minute,
    email_confirmed: b.email_confirmed,
    nonce: b.nonce,
    ts: b.ts,
  };
}

export async function verifySignature(
  secret: string,
  signatureHeader: unknown,
  payload: NotifyPayload
): Promise<boolean> {
  const received = parseSignatureHeader(signatureHeader);
  if (!received || !secret) return false;
  const canonical = buildCanonical({
    ts: payload.ts,
    userId: payload.user_id,
    createdMinute: payload.created_minute,
    confirmed: payload.email_confirmed,
    nonce: payload.nonce,
  });
  const expected = await hmacSha256Hex(secret, canonical);
  return timingSafeEqualHex(expected, received);
}

/** "2026-10-09T12:34:56.000Z" -> "2026-10-09 12:34" (display only). */
export function formatUtcMinute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function buildMessage(p: { createdMinute: string; emailConfirmed: boolean }): string {
  return (
    `🎉 New Freearn registration!\n` +
    `👤 A new user has signed up\n` +
    `📅 ${p.createdMinute} UTC\n` +
    `✉️ Email confirmed: ${p.emailConfirmed ? "Yes" : "No — not confirmed yet"}`
  );
}
