import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (singleton). Uses only the public anon key.
 * Never put secrets here.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  browserClient = createBrowserClient(url, anon);
  return browserClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** @deprecated Use lib/auth/server getSessionUser in server code. Kept for compatibility. */
export async function getSessionUser() {
  // Client components should read the session from getSupabaseBrowser().auth.getUser().
  return null;
}
