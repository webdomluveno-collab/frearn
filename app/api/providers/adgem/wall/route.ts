import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildAdgemWallUrl } from "@/lib/providers/adgem/wall";

/**
 * Returns the authenticated user's personal AdGem offerwall URL.
 * Auth required: playerid always comes from the trusted server session —
 * request input is ignored entirely, so one user cannot mint another
 * user's wall and unauthenticated callers get nothing personalized.
 * The URL carries only the public App ID + player UUID (no secrets exist
 * in the AdGem wall flow). Marked private/no-store: it is per-user.
 */
export async function GET() {
  // Note: request input is intentionally ignored — playerid comes from session only.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const url = buildAdgemWallUrl({ playerId: user.id });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
