import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`waitlist:${ip}`, 10)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  // TODO(waitlist): persist to Supabase `waitlist` table or email provider.
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { getSupabaseAdmin } = await import("@/lib/auth/server");
      const { error } = await getSupabaseAdmin()
        .from("waitlist")
        .insert({ email: parsed.data.email.toLowerCase() });
      // Duplicate email (unique violation) is fine — still confirm, no enumeration.
      if (error && error.code !== "23505") throw error;
    } else {
      console.log(`[waitlist] ${parsed.data.email}`);
    }
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
