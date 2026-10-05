import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildTimewallWallUrl, isTimewallTestUser, isTimewallWallAvailable } from "@/lib/providers/timewall/wall";

/**
 * Returns the authenticated user's personal TimeWall wall URL.
 * Controlled live test: in addition to auth and placement configuration,
 * only the exact test user (server-only TIMEWALL_TEST_USER_ID) may mint a
 * URL — everyone else receives the same 503 as an unconfigured wall, so no
 * test access is revealed. Auth required: userId always comes from the
 * trusted server session, never from browser input.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isTimewallTestUser(user.id) || !isTimewallWallAvailable()) {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
  try {
    const url = buildTimewallWallUrl({ userId: user.id });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
