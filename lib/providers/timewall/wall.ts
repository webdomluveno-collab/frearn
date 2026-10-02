/**
 * TimeWall offerwall URL mechanism (placement PENDING APPROVAL).
 *
 * Pure functions with NO secrets: the placement URL itself is public once
 * issued. There is deliberately no `import "server-only"` here so availability
 * checks are unit-testable anywhere — a guard test pins that no secret
 * reference may ever appear in this file.
 *
 * Until TimeWall issues the official Placement URL, `TIMEWALL_WALL_URL` stays
 * empty and every helper reports unavailable; the Earn UI hides the TimeWall
 * tab entirely (see registry + tabs), so no broken tab can reach production.
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
    throw new Error("TimeWall wall URL is not configured (placement pending approval).");
  }
  if (!input.userId) throw new Error("userId is required to build the TimeWall wall URL.");
  const url = new URL(base);
  url.searchParams.set("uid", input.userId);
  return url.toString();
}
