"use client";

import { useMemo, useState } from "react";
import { OpportunityCard } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DEMO_OPPORTUNITIES } from "@/lib/providers/mock";
import type { OpportunityCategory } from "@/types";

/** Development-only demo browser. Never rendered in production (see Earn page). */
export function DemoBrowser() {
  const cats: ("all" | OpportunityCategory)[] = ["all", "surveys", "offers", "games", "research", "app-testing", "microtasks"];
  const [cat, setCat] = useState<(typeof cats)[number]>("all");
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    return DEMO_OPPORTUNITIES.filter((o) => (cat === "all" ? true : o.category === cat)).filter((o) =>
      q ? (o.title + o.description).toLowerCase().includes(q.toLowerCase()) : true
    );
  }, [cat, q]);

  return (
    <section aria-label="Demo opportunities" className="space-y-5 rounded-2xl border border-dashed p-5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold tracking-tight">Browse (demo)</h2>
        <Badge tone="info">Demo · development only</Badge>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category filters">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`rounded-full border px-3 py-1.5 text-sm ${cat === c ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="block max-w-sm"><span className="sr-only">Search opportunities</span>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {items.length === 0 ? (
        <p className="rounded-2xl border p-6 text-sm text-muted-foreground">We&apos;re preparing opportunities for your region.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((o) => <OpportunityCard key={o.id} opp={o} demo />)}
        </div>
      )}
    </section>
  );
}
