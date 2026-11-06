"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, EmptyState } from "./fx/primitives";

/**
 * TheoremReach launcher. The signed entry URL is minted by the authenticated
 * server route; the browser never builds or signs it and never supplies a
 * user id.
 */
export function TheoremreachWall() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; url: string }
  >({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/providers/theoremreach/wall", { credentials: "same-origin" });
      if (res.status === 401) {
        setState({ status: "error", message: "Please sign in again to load surveys." });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: "TheoremReach surveys are temporarily unavailable. Please try again later." });
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setState({ status: "error", message: "TheoremReach surveys are temporarily unavailable. Please try again later." });
        return;
      }
      setState({ status: "ready", url: data.url });
    } catch {
      setState({ status: "error", message: "Could not load TheoremReach surveys. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div className="provider-loading" role="status" aria-label="Loading TheoremReach surveys" aria-busy="true">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <p className="muted">Preparing your TheoremReach surveys…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert">
        <EmptyState icon="warning" title="TheoremReach unavailable right now" description={state.message}>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="surface muted-panel provider-ready">
      <p><strong>Your personal TheoremReach surveys are ready.</strong></p>
      <p className="muted">Complete surveys matched to your profile. Opens in a new tab.</p>
      <ButtonLink href={state.url} target="_blank" rel="noopener noreferrer">
        Open TheoremReach
      </ButtonLink>
    </div>
  );
}
