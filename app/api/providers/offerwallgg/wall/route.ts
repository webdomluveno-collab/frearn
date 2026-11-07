import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { buildOfferwallggPreviewUrl, isOfferwallggPreviewEnabled } from "@/lib/providers/offerwallgg/server";

/** Admin-only preview. Never includes a userId and never enables paid tasks. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
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
