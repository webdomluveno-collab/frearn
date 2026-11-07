import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { buildOfferwallggPreviewUrl, buildOfferwallggSignedUserUrl, isOfferwallggPreviewEnabled } from "@/lib/providers/offerwallgg/server";
import { isOfferwallggLiveEnabled } from "@/lib/providers/offerwallgg/financial";

/** Signed user URL only when every financial gate is enabled. Admin preview otherwise. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (isOfferwallggLiveEnabled()) {
    try {
      return NextResponse.json(
        { url: buildOfferwallggSignedUserUrl(user.id), previewOnly: false },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    } catch {
      return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
    }
  }
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isOfferwallggPreviewEnabled()) {
    return NextResponse.json({ error: "preview_unavailable" }, { status: 503 });
  }
  try {
    return NextResponse.json(
      { url: buildOfferwallggPreviewUrl(), previewOnly: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "preview_unavailable" }, { status: 503 });
  }
}
