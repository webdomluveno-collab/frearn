import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildTheoremreachEntryUrl, isTheoremreachWallConfigured } from "@/lib/providers/theoremreach/server";

/**
 * Returns the authenticated user's personal TheoremReach entry URL.
 * Phase 1 (testing only): the signed URL enables dashboard entry-flow
 * testing. No money can move — postback crediting is disabled.
 * Auth required: userId always comes from the trusted server session,
 * never from browser input. This route accepts no user-supplied identity.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!isTheoremreachWallConfigured()) {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
  try {
    const url = buildTheoremreachEntryUrl({ userId: user.id });
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
