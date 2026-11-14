"use client";

import { useEffect, useState } from "react";

export function AdmantumWall() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; url: string }>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/providers/admantum/wall", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("wall_unavailable");
        const data = (await response.json()) as { url?: string };
        if (!data.url) throw new Error("wall_url_missing");
        if (active) setState({ status: "ready", url: data.url });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => { active = false; };
  }, []);

  if (state.status === "loading") return <p role="status">Loading AdMantum offers…</p>;
  if (state.status === "error") return <p role="alert">AdMantum is temporarily unavailable.</p>;
  return <iframe className="wall-frame" src={state.url} title="AdMantum offers and surveys" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />;
}
