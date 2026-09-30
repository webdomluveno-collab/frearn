"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdGemOfferWall } from "./adgem-offer-wall";
import { CpxSurveyWall } from "./cpx-survey-wall";
import { Badge } from "./fx/primitives";
import { Icon } from "./fx/icon";

type ProviderKey = "surveys" | "offers";

const TABS: Array<{ key: ProviderKey; label: string; hash: string }> = [
  { key: "surveys", label: "Surveys", hash: "#surveys" },
  { key: "offers", label: "Offers & Games", hash: "#offers" },
];

function initialTab(): ProviderKey {
  if (typeof window !== "undefined" && window.location.hash === "#offers") return "offers";
  return "surveys";
}

/**
 * Earn provider selector. Accessible tablist (arrow-key navigation, roving
 * tabindex); only the selected provider's wall is mounted so a single
 * third-party iframe ever loads. Defaults to Surveys (existing UX).
 * The selection syncs to the URL hash so provider cards elsewhere can
 * deep-link to a tab without full-page navigation.
 */
export function EarnProviderTabs({ cpxLive }: { cpxLive: boolean }) {
  const [selected, setSelected] = useState<ProviderKey>("surveys");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSelected(initialTab());
    const onHash = () => setSelected(initialTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function select(key: ProviderKey) {
    setSelected(key);
    const hash = TABS.find((t) => t.key === key)?.hash ?? "#surveys";
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const idx = TABS.findIndex((t) => t.key === selected);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== null) {
      e.preventDefault();
      select(TABS[next].key);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div className="space-y-4">
      <div className="earn-toolbar">
        <div className="category-tabs" role="tablist" aria-label="Earning opportunities" onKeyDown={onKeyDown}>
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
              onClick={() => select(t.key)}
              className={selected === t.key ? "selected" : ""}
            >
              <Icon name={t.key === "surveys" ? "survey" : "game"} size={18} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`earn-panel-${selected}`}
        aria-labelledby={`earn-tab-${selected}`}
      >
        {selected === "surveys" ? (
          <section aria-label="Surveys" className="space-y-4">
            <div className="section-title">
              <div>
                <h2>Surveys</h2>
                <p>Complete surveys matched to your profile and earn rewards.</p>
              </div>
            </div>
            {cpxLive ? (
              <CpxSurveyWall />
            ) : (
              <div className="surface muted-panel">
                <p>
                  <strong>We&apos;re preparing surveys for your region.</strong>
                </p>
                <p className="muted">
                  Availability varies by country and profile. Complete your{" "}
                  <Link href="/dashboard/profile" className="text-link">profile</Link> so we can match
                  you with relevant opportunities as soon as they open.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Offers and games" className="space-y-4">
            <div className="section-title">
              <div>
                <h2>Offers &amp; Games</h2>
                <p>Complete offers, games, and tasks to earn rewards. Availability varies.</p>
              </div>
            </div>
            <AdGemOfferWall />
          </section>
        )}
      </div>

      <section className="partner-section">
        <div className="section-title">
          <div>
            <h2>Where your rewards come from</h2>
            <p>Live provider status, with the same clear reward details.</p>
          </div>
          <Badge>Live status</Badge>
        </div>
        <div className="partner-list">
          <button onClick={() => select("surveys")}>
            <span className="partner-monogram">C</span>
            <span>
              <strong>Share your perspective</strong>
              <span>CPX Research · {cpxLive ? "Available now" : "Preparing for your region"}</span>
            </span>
            <Icon name="external" size={17} />
          </button>
          <button onClick={() => select("offers")}>
            <span className="partner-monogram">A</span>
            <span>
              <strong>Try something new</strong>
              <span>AdGem · Available now</span>
            </span>
            <Icon name="external" size={17} />
          </button>
          <div className="partner-row-muted" aria-label="TimeWall, pending approval">
            <span className="partner-monogram">T</span>
            <span>
              <strong>Find a quick task</strong>
              <span>TimeWall · Pending approval</span>
            </span>
            <Badge tone="neutral">Coming later</Badge>
          </div>
        </div>
        <div className="feed-note">
          <Icon name="help" size={17} />
          <p>
            Rewards and times are estimates. Eligibility and completion requirements vary. Always
            review the details first.
          </p>
        </div>
      </section>
    </div>
  );
}
