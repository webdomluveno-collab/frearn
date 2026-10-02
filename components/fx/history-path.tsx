'use client';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { TallyMeter } from './tally';
const tiers = [
  {
    name: 'Start',
    share: '50%',
    note: 'A place to begin. Your first confirmed activity starts your history.',
  },
  {
    name: 'Explorer',
    share: '55%',
    note: 'Find what fits. Build a record of confirmed activities over time.',
  },
  {
    name: 'Regular',
    share: '60%',
    note: 'A growing history. Return at your own pace and keep your activity in view.',
  },
  {
    name: 'Steady',
    share: '65%',
    note: 'Consistent participation. A proposed milestone for a longer activity history.',
  },
  {
    name: 'Trusted',
    share: '70%',
    note: 'Time well spent. A proposed recognition of established participation.',
  },
  {
    name: 'Plus',
    share: '75%',
    note: 'More history behind you. A future tier whose requirements are still being designed.',
  },
  {
    name: 'Prime',
    share: '80%',
    note: 'A substantial record. A future milestone for long-term participation.',
  },
  {
    name: 'Max',
    share: '85%',
    note: 'The highest illustrated share. A possibility being explored, not a promised payout.',
  },
];
export function HistoryPath({
  fresh = false,
  publicView = false,
}: {
  fresh?: boolean;
  publicView?: boolean;
}) {
  const current = fresh ? 0 : 1;
  const [selected, setSelected] = useState(publicView ? 7 : current);
  return (
    <div className="history-path">
      <div className="path-topline">
        <span className="eyebrow">THE FREEARN TALLY</span>
        <span className="concept-label">50–85% · design concept</span>
      </div>
      <div className="path-stairs" role="group" aria-label="Explore proposed loyalty tiers">
        {tiers.map((tier, index) => (
          <button
            key={tier.name}
            className={`path-tier ${selected === index ? 'selected' : ''} ${!publicView && current === index ? 'current' : ''}`}
            style={{ '--tier': index } as CSSProperties}
            aria-pressed={selected === index}
            aria-label={`${tier.name}, ${tier.share} proposed reward share${!publicView && current === index ? ', sample current level' : ''}`}
            onClick={() => setSelected(index)}
          >
            <span className="tier-stack" aria-hidden="true">
              {Array.from({ length: index + 3 }, (_, row) => (
                <i key={row} />
              ))}
            </span>
            <span className="tier-share">{tier.share}</span>
            <span className="tier-name">{tier.name}</span>
            <span className="tier-index">
              {!publicView && current === index ? 'YOU · SAMPLE' : `0${index + 1}`}
            </span>
          </button>
        ))}
      </div>
      <div className="tier-insight" aria-live="polite">
        <span className="tier-insight-number">0{selected + 1}</span>
        <div>
          <h3>
            {tiers[selected].name} <span>{tiers[selected].share} proposed share</span>
          </h3>
          <p>{tiers[selected].note}</p>
        </div>
      </div>
      {!publicView && (
        <div className="path-current-progress">
          <div>
            <strong>
              {fresh ? 'Start' : 'Explorer'} <span>· current sample level</span>
            </strong>
            <p>{fresh ? 'Explorer is your next step.' : 'Regular is your next step.'}</p>
          </div>
          <div>
            <TallyMeter value={fresh ? 0 : 74} label="Sample progress to next level" />
            <span>{fresh ? '0 / 500' : '740 / 1,000'} example XP · thresholds not final</span>
          </div>
        </div>
      )}
      <p className="path-disclaimer">
        Loyalty is being designed. Shares, tiers, thresholds and eligibility are not final. These
        illustrations never calculate rewards or change payouts.
      </p>
    </div>
  );
}
