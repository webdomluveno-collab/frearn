"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CpxSurveyWall } from "./cpx-survey-wall";
import { TheoremreachWall } from "./theoremreach-wall";
import { TimewallWall } from "./timewall-wall";
import { OfferwallggPreview } from "./offerwallgg-preview";
import { Badge } from "./fx/primitives";
import { Icon } from "./fx/icon";

type ProviderKey = "surveys" | "timewall" | "theoremreach" | "offerwallgg";

interface EarnTab {
  key: ProviderKey;
  label: string;
  hash: string;
}

const BASE_TABS: EarnTab[] = [
  { key: "surveys", label: "Surveys", hash: "#surveys" },
  { key: "timewall", label: "TimeWall", hash: "#timewall" },
];

const THEOREMREACH_TAB: EarnTab = {
  key: "theoremreach",
  label: "TheoremReach",
  hash: "#theoremreach",
};

const OFFERWALLGG_PREVIEW_TAB: EarnTab = { key: "offerwallgg", label: "Offerwall.GG Preview", hash: "#offerwallgg" };
const OFFERWALLGG_LIVE_TAB: EarnTab = { key: "offerwallgg", label: "Offerwall.GG", hash: "#offerwallgg" };

function tabForHash(tabs: EarnTab[], hash: string): ProviderKey {
  // The old empty AdGem tab is retired. Preserve existing #offers bookmarks.
  if (hash === "#offers") return tabs.some((t) => t.key === "offerwallgg") ? "offerwallgg" : "timewall";
  return tabs.find((t) => t.hash === hash)?.key ?? "surveys";
}

/**
 * Earn provider selector. Accessible tablist (arrow-key navigation, roving
 * tabindex); only the selected provider's panel is mounted (CPX and the
 * admin-only Offerwall.GG preview use iframes; TimeWall opens in a new tab).
 * Defaults to Surveys (existing UX).
 * The selection syncs to the URL hash so provider cards elsewhere can
 * deep-link to a tab without full-page navigation.
 *
 * TimeWall is live for all authenticated users: its wall URL is minted
 * server-side per session and opened in a new tab.
 */
export function EarnProviderTabs({ cpxLive, theoremreachLive = false, offerwallggPreview = false, offerwallggLive = false }: { cpxLive: boolean; theoremreachLive?: boolean; offerwallggPreview?: boolean; offerwallggLive?: boolean }) {
  const TABS = useMemo(() => [BASE_TABS[0], ...(offerwallggLive ? [OFFERWALLGG_LIVE_TAB] : offerwallggPreview ? [OFFERWALLGG_PREVIEW_TAB] : []), BASE_TABS[1], ...(theoremreachLive ? [THEOREMREACH_TAB] : [])], [theoremreachLive, offerwallggPreview, offerwallggLive]);
  const [selected, setSelected] = useState<ProviderKey>("surveys");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // An unknown hash falls back to Surveys.
  useEffect(() => {
    setSelected(tabForHash(TABS, window.location.hash));
    const onHash = () => setSelected(tabForHash(TABS, window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [TABS]);

  function select(key: ProviderKey) {
    const valid = TABS.some((t) => t.key === key) ? key : "surveys";
    setSelected(valid);
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
              aria-label={t.label}
              id={`earn-tab-${t.key}`}
              aria-selected={selected === t.key}
              aria-controls={`earn-panel-${t.key}`}
              tabIndex={selected === t.key ? 0 : -1}
              onClick={() => select(t.key)}
              className={selected === t.key ? "selected" : ""}
            >
              <Icon name={t.key === "surveys" || t.key === "theoremreach" ? "survey" : t.key === "timewall" ? "task" : "game"} size={18} />
              <span className="provider-tab-copy"><strong>{t.label}</strong><small>{t.key === "surveys" ? "Share your perspective" : t.key === "theoremreach" ? "Take surveys and earn" : t.key === "offerwallgg" ? (offerwallggLive ? "Offers, surveys & games" : "Admin-only, no rewards") : "Little tasks, more possibilities"}</small></span>
              <Icon name="chevron" size={17} />
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
              <div className="surface muted-panel provider-unavailable">
                <span className="provider-state-symbol" aria-hidden="true"><Icon name="survey" size={30} /></span>
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
        ) : selected === "theoremreach" ? (
          <section aria-label="TheoremReach" className="space-y-4">
            <div className="section-title">
              <div>
                <h2>TheoremReach</h2>
                <p>Complete surveys matched to your profile and earn rewards.</p>
              </div>
            </div>
            <TheoremreachWall />
          </section>
        ) : selected === "offerwallgg" ? (
          <section aria-label={offerwallggLive ? "Offerwall.GG" : "Offerwall.GG Preview"} className="space-y-4">
            <div className="section-title"><div><h2>{offerwallggLive ? "Offerwall.GG" : "Offerwall.GG Preview"}</h2><p>{offerwallggLive ? "Complete offers, surveys and games to earn rewards." : "Admin preview only. No rewards are credited."}</p></div></div>
            <OfferwallggPreview />
          </section>
        ) : selected === "timewall" ? (
          <section aria-label="TimeWall" className="space-y-4">
            <div className="section-title">
              <div>
                <h2>TimeWall</h2>
                <p>Surveys, tasks, games and more. Availability varies by location and eligibility.</p>
              </div>
            </div>
            <TimewallWall />
          </section>
        ) : null}
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
          {(offerwallggPreview || offerwallggLive) && (
            <button onClick={() => select("offerwallgg")}>
              <span className="partner-monogram">O</span>
              <span><strong>{offerwallggLive ? "Offerwall.GG" : "Offerwall.GG Preview"}</strong><span>{offerwallggLive ? "Available now" : "Admin-only · No rewards"}</span></span>
              <Icon name="external" size={17} />
            </button>
          )}
          <button onClick={() => select("timewall")}>
            <span className="partner-monogram">T</span>
            <span>
              <strong>Do tasks and more</strong>
              <span>TimeWall · Open in a new tab</span>
            </span>
            <Icon name="external" size={17} />
          </button>
          {theoremreachLive && (
            <button onClick={() => select("theoremreach")}>
              <span className="partner-monogram">T</span>
              <span>
                <strong>Share your perspective</strong>
                <span>TheoremReach · Open in a new tab</span>
              </span>
              <Icon name="external" size={17} />
            </button>
          )}
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
