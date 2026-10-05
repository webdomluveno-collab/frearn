/**
 * TimeWall offerwall URL mechanism.
 *
 * Pure functions with NO secrets: the placement URL itself is public once
 * issued. There is deliberately no `import "server-only"` here so availability
 * checks are unit-testable anywhere — a guard test pins that no secret
 * reference may ever appear in this file.
 *
 * Controlled live test: the placement is approved, but TimeWall stays hidden
 * from normal users. Wall access additionally requires an exact match with
 * the server-only `TIMEWALL_TEST_USER_ID` (see isTimewallTestUser). The Earn
 * UI and the wall route both enforce this server-side; when unset, nobody
 * has access. Remove the gate only for public rollout.
 */

export function timewallWallUrl(): string | null {
  const raw = process.env.TIMEWALL_WALL_URL?.trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return parsed.toString();
}

/** True only once the official Placement URL is configured. */
export function isTimewallWallAvailable(): boolean {
  return timewallWallUrl() !== null;
}

/**
 * Controlled live-test gate: true only for the exact authenticated test
 * user. Server-side only in effect — callers (Earn page, wall route) run on
 * the server and compare the session UUID; the UUID itself is never rendered
 * or sent to the browser. Unset/empty env ⇒ nobody has access (fail closed).
 * No query-string, body, or client value can satisfy this: only the trusted
 * session UUID is ever compared.
 */
export function isTimewallTestUser(userId: string | null | undefined): boolean {
  const allowed = process.env.TIMEWALL_TEST_USER_ID?.trim();
  if (!allowed) return false;
  return userId === allowed;
}

export interface BuildTimewallWallInput {
  /** Stable Supabase auth UUID from the trusted server session. */
  userId: string;
}

/**
 * Build the personalized wall URL. The UUID is attached as the `uid`
 * query parameter, matching TimeWall's official offerwall URL contract
 * (`.../users/login?oid=<placement>&uid=<user>`). This is intentionally
 * different from the INBOUND postback field, which TimeWall sends back as
 * `userid` (see ./shared.ts + process.ts — unchanged).
 * Existing base query parameters (e.g. `oid`) are preserved via the
 * URL/URLSearchParams API — no manual query-string concatenation.
 */
export function buildTimewallWallUrl(input: BuildTimewallWallInput): string {
  const base = timewallWallUrl();
  if (!base) {
    throw new Error("TimeWall wall URL is not configured.");
  }
  if (!input.userId) throw new Error("userId is required to build the TimeWall wall URL.");
  const url = new URL(base);
  url.searchParams.set("uid", input.userId);
  return url.toString();
}
