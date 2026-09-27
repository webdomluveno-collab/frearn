import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface SessionUser {
  id: string;
  email: string | null;
}

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL).");
  return url;
}

function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  return key;
}

/** True when the app has Supabase credentials and can do real auth/DB. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cookie-aware server client for Server Components / Route Handlers. */
export function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where set is not allowed — middleware refreshes instead.
        }
      },
    },
  });
}

/**
 * Service-role client for TRUSTED server code only (callbacks, admin reads).
 * Bypasses RLS — never import from client components, never expose the key.
 */
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createSupabaseClient(supabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Authenticated user from trusted server session, or null. Never trust client input. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Throw when there is no authenticated user. Use in server routes that need ext_user_id. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("Authentication required.");
    (err as NodeJS.ErrnoException).code = "UNAUTHENTICATED";
    throw err;
  }
  return user.id;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
