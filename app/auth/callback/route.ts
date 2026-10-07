import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/auth/server";

/** Handles Supabase email-confirmation / OAuth code exchange, then lands in the app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    try {
      const supabase = getSupabaseServer();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard", url.origin));
      }
    } catch {
      // Fall through to login with an error flag.
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirm", url.origin));
}
