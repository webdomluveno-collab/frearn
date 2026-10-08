"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState } from "./fx/primitives";

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
      <div className="provider-loading" role="status" aria-label="Loading surveys" aria-busy="true">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <p className="muted">Loading surveys matched to your profile…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert">
        <EmptyState icon="warning" title="Surveys unavailable right now" description={state.message}>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wall-frame">
      <iframe
        src={state.url}
        title="Surveys — complete surveys matched to your profile and earn rewards"
        loading="lazy"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
