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
 * Build the personalized wall URL. The UUID is attached as the `userid`
 * query parameter, matching TimeWall's own postback `userid` naming
 * convention. If the official Placement URL uses a different parameter name,
 * update ONLY this function after approval — no redesign needed.
 */
export function buildTimewallWallUrl(input: BuildTimewallWallInput): string {
  const base = timewallWallUrl();
  if (!base) {
    throw new Error("TimeWall wall URL is not configured (placement pending approval).");
  }
  if (!input.userId) throw new Error("userId is required to build the TimeWall wall URL.");
  const url = new URL(base);
  url.searchParams.set("userid", input.userId);
  return url.toString();
}
