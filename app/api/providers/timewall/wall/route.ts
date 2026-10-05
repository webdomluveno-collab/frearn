import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildTimewallWallUrl, isTimewallWallAvailable } from "@/lib/providers/timewall/wall";

/**
 * Returns the authenticated user's personal TimeWall wall URL.
 * Live for all authenticated users. The URL is built server-side from the
 * trusted session UUID — the route takes no request input, so no query/body
 * value can override it. Unauthenticated callers get 401.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isTimewallWallAvailable()) {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
  try {
    const url = buildTimewallWallUrl({ userId: user.id });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
