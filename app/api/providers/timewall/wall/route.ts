import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildTimewallWallUrl, isTimewallWallAvailable } from "@/lib/providers/timewall/wall";

/**
 * Returns the authenticated user's personal TimeWall wall URL.
 * Currently UNAVAILABLE: the placement is pending approval and no official
 * Placement URL exists, so this endpoint always answers 503. It exists so
 * the Earn wiring is ready the moment the URL is configured — no redesign,
 * no broken tab (the UI hides TimeWall until `isTimewallWallAvailable()`).
 * Auth required: userId always comes from the trusted server session,
 * never from browser input.
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
