"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, EmptyState } from "./fx/primitives";

/**
 * TimeWall launcher (live for all authenticated users).
 * The personalized wall URL is minted server-side for the signed-in user
 * (/api/providers/timewall/wall) and opened in a new tab — TimeWall sessions
 * are unreliable inside embedded iframes, while a normal tab works. The
 * browser never sees secrets and never supplies the user id. The action
 * button stays disabled while the URL is being fetched (no double-click
 * spam); failures show a friendly retry instead of backend errors.
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
        <p className="muted">Preparing your TimeWall…</p>
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
    <div className="surface muted-panel">
      <p>
        <strong>Your personal TimeWall is ready.</strong>
      </p>
      <p className="muted">Complete surveys, tasks, games and more. Opens in a new tab.</p>
      <ButtonLink href={state.url} target="_blank" rel="noopener noreferrer">
        Open TimeWall
      </ButtonLink>
    </div>
  );
}
