"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState } from "./fx/primitives";

/**
 * Authenticated AdGem offerwall embed. The wall URL is minted server-side for
 * the signed-in user (/api/providers/adgem/wall) — the browser never sees
 * secrets (none exist in this flow: only the public App ID + player UUID).
 *
 * An empty/unavailable third-party wall is NOT treated as an application
 * error: if the URL loads, the iframe renders whatever AdGem returns
 * (including its own empty states).
 */
export function AdGemOfferWall() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; url: string }>({
    status: "loading",
  });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/providers/adgem/wall", { credentials: "same-origin" });
      if (res.status === 401) {
        setState({ status: "error", message: "Please sign in again to load offers." });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: "Offers are temporarily unavailable. Please try again later." });
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setState({ status: "error", message: "Offers are temporarily unavailable. Please try again later." });
        return;
      }
      setState({ status: "ready", url: data.url });
    } catch {
      setState({ status: "error", message: "Could not load offers. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading offers" aria-busy="true">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <p className="muted">Loading offers and games…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert">
        <EmptyState icon="warning" title="Offers unavailable right now" description={state.message}>
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
        title="Offers and games — complete offers and tasks to earn rewards"
        loading="lazy"
        allowFullScreen
        // Minimal permissions an offerwall needs to render and interact:
        // scripts + forms + popups. Deliberately no `allow` attribute
        // (no camera/mic/location) and no top-level navigation.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
