"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await getSupabaseBrowser().auth.signOut();
        } finally {
          router.push("/login");
          router.refresh();
        }
      }}
      className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <LogOut size={15} aria-hidden /> {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
