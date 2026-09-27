"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AdGemOfferWall } from "./adgem-offer-wall";
import { CpxSurveyWall } from "./cpx-survey-wall";
import { cn } from "@/lib/utils";

type ProviderKey = "surveys" | "offers";

const TABS: Array<{ key: ProviderKey; label: string }> = [
  { key: "surveys", label: "Surveys" },
  { key: "offers", label: "Offers & Games" },
];

/**
 * Earn provider selector. Accessible tablist (arrow-key navigation, roving
 * tabindex); only the selected provider's wall is mounted so a single
 * third-party iframe ever loads. Defaults to Surveys (existing UX).
 */
export function EarnProviderTabs({ cpxLive }: { cpxLive: boolean }) {
  const [selected, setSelected] = useState<ProviderKey>("surveys");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.findIndex((t) => t.key === selected);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      setSelected(TABS[next].key);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Earning opportunities" onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`earn-tab-${t.key}`}
            aria-selected={selected === t.key}
            aria-controls={`earn-panel-${t.key}`}
            tabIndex={selected === t.key ? 0 : -1}
            onClick={() => setSelected(t.key)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              selected === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`earn-panel-${selected}`}
        aria-labelledby={`earn-tab-${selected}`}
      >
        {selected === "surveys" ? (
          <section aria-label="Surveys" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Surveys</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete surveys matched to your profile and earn rewards.
              </p>
            </div>
            {cpxLive ? (
              <CpxSurveyWall />
            ) : (
              <div className="rounded-2xl border bg-card p-6 card-shadow">
                <p className="font-semibold">We&apos;re preparing surveys for your region.</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Availability varies by country and profile. Complete your{" "}
                  <Link href="/dashboard/profile" className="underline">profile</Link> so we can match
                  you with relevant opportunities as soon as they open.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Offers and games" className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Offers &amp; Games</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete offers, games, and tasks to earn rewards. Availability varies.
              </p>
            </div>
            <AdGemOfferWall />
          </section>
        )}
      </div>
    </div>
  );
}
