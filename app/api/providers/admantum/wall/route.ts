import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { buildAdmantumWallUrl, isAdmantumWallEnabledForUser } from "@/lib/providers/admantum/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdmantumWallEnabledForUser(user.id)) return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  try {
    return NextResponse.json({ url: buildAdmantumWallUrl(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "wall_unavailable" }, { status: 503 });
  }
}
