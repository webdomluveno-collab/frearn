import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function middleware(req: NextRequest) {
  // Refresh the Supabase session on every request so server components see it.
  // Skip entirely when Supabase is not configured (pre-launch local mode).
  let userEmail: string | null = null;
  if (supabaseConfigured()) {
    const res = NextResponse.next({ request: req });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      }
    );
    const { data } = await supabase.auth.getUser();
    userEmail = data.user?.email ?? null;
    if (req.nextUrl.pathname.startsWith("/admin")) {
      // Deny by default: 404 (do not leak admin existence) unless allowlisted admin.
      if (!isAdminEmail(userEmail)) return new NextResponse("Not found", { status: 404 });
    }
    return res;
  }

  // Unconfigured: keep previous deny-by-default behavior for /admin.
  if (req.nextUrl.pathname.startsWith("/admin")) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
