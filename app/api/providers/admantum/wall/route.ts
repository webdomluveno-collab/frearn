import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { buildAdmantumWallUrl, isAdmantumAdminPreviewEnabled, isAdmantumWallEnabledForUser } from "@/lib/providers/admantum/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const live = isAdmantumWallEnabledForUser(user.id);
  const adminPreview = isAdminEmail(user.email) && isAdmantumAdminPreviewEnabled();
  if (!live && !adminPreview) return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  try {
    return NextResponse.json({ url: buildAdmantumWallUrl(user.id), previewOnly: !live }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
