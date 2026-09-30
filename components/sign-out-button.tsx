"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/auth/client";
import { Icon } from "./fx/icon";

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
      className="nav-link"
      style={{ width: "100%" }}
    >
      <Icon name="logout" />
      <span>{loading ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
