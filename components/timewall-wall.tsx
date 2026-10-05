"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState } from "./fx/primitives";

/**
 * Authenticated TimeWall offerwall embed (controlled live test only).
 * The wall URL is minted server-side for the signed-in test user
 * (/api/providers/timewall/wall) — the browser never sees secrets and never
 * supplies the user id. Mounted only behind the server-computed
 * `timewallTestAccess` prop in Earn tabs; never rendered for normal users.
 */
export function TimewallWall() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; url: string }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/providers/timewall/wall", { credentials: "same-origin" });
      if (res.status === 401) {
        setState({ status: "error", message: "Please sign in again to load tasks." });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: "Tasks are temporarily unavailable. Please try again later." });
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setState({ status: "error", message: "Tasks are temporarily unavailable. Please try again later." });
        return;
      }
      setState({ status: "ready", url: data.url });
    } catch {
      setState({ status: "error", message: "Could not load tasks. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading tasks" aria-busy="true">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <p className="muted">Loading tasks…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert">
        <EmptyState icon="warning" title="Tasks unavailable right now" description={state.message}>
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
        title="TimeWall tasks — complete tasks and earn rewards"
        loading="lazy"
        allowFullScreen
        // TimeWall is the same interaction class as the other offerwalls
        // (renders pages, submits forms, opens provider links): scripts +
        // forms + popups. Deliberately no `allow` attribute (no
        // camera/mic/location) and no top-level navigation.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
