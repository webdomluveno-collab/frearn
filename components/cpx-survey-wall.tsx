"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

/**
 * Authenticated CPX SurveyWall embed. The wall URL is minted server-side for
 * the signed-in user (/api/providers/cpx/wall) — the browser never sees secrets.
 */
export function CpxSurveyWall() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; url: string }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/providers/cpx/wall", { credentials: "same-origin" });
      if (res.status === 401) {
        setState({ status: "error", message: "Please sign in again to load surveys." });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: "Surveys are temporarily unavailable. Please try again later." });
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setState({ status: "error", message: "Surveys are temporarily unavailable. Please try again later." });
        return;
      }
      setState({ status: "ready", url: data.url });
    } catch {
      setState({ status: "error", message: "Could not load surveys. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading surveys" className="rounded-2xl border bg-card p-6 card-shadow">
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading surveys matched to your profile…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-2xl border bg-card p-6 text-center card-shadow">
        <p className="font-semibold">Surveys unavailable right now</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{state.message}</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>
          <RotateCcw /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card card-shadow">
      <iframe
        src={state.url}
        title="Surveys — complete surveys matched to your profile and earn rewards"
        className="h-[720px] min-h-[70vh] w-full border-0"
        loading="lazy"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
