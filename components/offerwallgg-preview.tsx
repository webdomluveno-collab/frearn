"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, EmptyState } from "./fx/primitives";

/** No credited offers: this deliberately opens the provider's preview mode. */
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
      if (url.origin !== "https://offerwall.gg" || !url.pathname.startsWith("/wall/")) {
        return setState({ type: "error" });
      }
      setState({ type: "ready", url: data.url });
    } catch {
      setState({ type: "error" });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (state.type === "loading") return <p role="status">Loading Offerwall.GG preview…</p>;
  if (state.type === "error") {
    return <EmptyState icon="warning" title="Offerwall.GG preview unavailable" description="The placement may still be pending approval.">
      <Button variant="secondary" onClick={() => void load()}>Try again</Button>
    </EmptyState>;
  }
  return <div className="surface muted-panel provider-ready">
    <p><strong>Offerwall.GG preview only — rewards disabled.</strong></p>
    <p className="muted">You can inspect the partner wall. Offer clicks cannot be credited in preview mode.</p>
    <ButtonLink href={state.url} target="_blank" rel="noopener noreferrer">Open Offerwall.GG preview</ButtonLink>
  </div>;
}
