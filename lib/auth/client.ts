import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-ready auth architecture.
 * The app runs without credentials (demo/pre-launch mode).
 * When env vars are set, callers can use getSupabase() for auth/db.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, anon);
}

/** Placeholder session — replace with real Supabase Auth session. */
export async function getSessionUser() {
  // TODO(auth): wire Supabase Auth (email verification, Google login later).
  return null;
}
