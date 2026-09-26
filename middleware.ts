import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protect /admin by default.
 * TODO(auth): check Supabase session + ADMIN_EMAILS allowlist; redirect to /login.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    // No session implemented yet → deny with 404 to avoid leaking admin existence.
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
