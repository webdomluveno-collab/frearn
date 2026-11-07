"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, EmptyState } from "./fx/primitives";

/**
 * Admin-only, uncredited Offerwall.GG iframe preview. The server deliberately
 * omits userId, and this component refuses to render an attributable URL.
 * Real offerwall rewards must not be enabled until financial postbacks are
 * implemented and reconciled.
 */
export function OfferwallggPreview() {
  const [state, setState] = useState<
    { type: "loading" } | { type: "error" } | { type: "ready"; url: string }
  >({ type: "loading" });

  const load = useCallback(async () => {
    setState({ type: "loading" });
    try {
      const response = await fetch("/api/providers/offerwallgg/wall", { credentials: "same-origin" });
      if (!response.ok) return setState({ type: "error" });
      const data = (await response.json()) as { url?: string; previewOnly?: boolean };
      if (!data.previewOnly || !data.url) return setState({ type: "error" });
      const url = new URL(data.url);
      if (
        url.origin !== "https://offerwall.gg" ||
        !/^\/wall\/[a-f0-9]{32}$/.test(url.pathname) ||
        url.searchParams.has("userId") ||
        url.searchParams.has("userid")
      ) {
        return setState({ type: "error" });
      }
      setState({ type: "ready", url: data.url });
    } catch {
      setState({ type: "error" });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state.type === "loading") {
    return <p role="status">Loading Offerwall.GG preview…</p>;
  }

  if (state.type === "error") {
    return (
      <div role="alert">
        <EmptyState
          icon="warning"
          title="Offerwall.GG preview unavailable"
          description="Check that the placement is active and preview is enabled."
        >
          <Button variant="secondary" onClick={() => void load()}>Try again</Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface muted-panel provider-ready">
        <p><strong>Offerwall.GG preview only — rewards disabled.</strong></p>
        <p className="muted">
          Explore the available offers below. Offer clicks and reward credits are disabled in preview mode.
        </p>
      </div>

      <div className="wall-frame">
        <iframe
          src={state.url}
          title="Offerwall.GG — admin preview only, rewards disabled"
          loading="lazy"
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <p className="muted">
        If the embedded preview is blocked by your placement settings, check your allowed domains
        or <ButtonLink href={state.url} target="_blank" rel="noopener noreferrer">open the preview in a new tab</ButtonLink>.
      </p>
    </div>
  );
}
