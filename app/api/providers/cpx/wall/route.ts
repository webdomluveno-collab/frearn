import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildSurveyWallUrl, isCpxConfigured } from "@/lib/providers/cpx/server";

/**
 * Returns the authenticated user's personal CPX SurveyWall URL.
 * Auth required: ext_user_id always comes from the trusted server session,
 * never from browser input — one user cannot generate another user's wall.
 * The URL contains the per-user hash (required by CPX) but never the secret.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isCpxConfigured()) {
    return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  }
  try {
    const url = buildSurveyWallUrl({ extUserId: user.id, email: user.email });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
