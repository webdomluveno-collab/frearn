'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { payoutPreview } from './payout-preview';
import styles from '@/app/(public)/homepage.module.css';
export function HomepageMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-seen', 'true');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    element.querySelectorAll('[data-reveal]').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  return (
    <div className={styles.home} ref={root} data-paused={paused}>
      <button
        className={styles.motionToggle}
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? 'Motion paused' : 'Pause motion'}{' '}
        <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
      </button>
      {children}
    </div>
  );
}
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export function PayoutSlider() {
  const [share, setShare] = useState(70);
  const preview = payoutPreview(share);
  const style = { '--fill': `${((preview.share - 50) / 35) * 100}%` } as CSSProperties;
  return (
    <div className={styles.calculator} style={style}>
      <div className={styles.calculatorTop}>
        <span>ONE EXAMPLE ACTIVITY</span>
        <span>
          Provider reward <strong>$1.48</strong>
        </span>
      </div>
      <div className={styles.calculatorNumbers}>
        <div>
          <label htmlFor="reward-share">Your planned share</label>
          <strong className={styles.shareNumber}>
            <span key={share} className={styles.numberChange}>
              {preview.share}
            </span>
            <span>%</span>
          </strong>
        </div>
        <div className={styles.rewardNumber}>
          <span>Your example reward</span>
          <output htmlFor="reward-share" aria-live="polite" aria-atomic="true">
            <span key={share} className={styles.numberChange}>
              {dollars(preview.rewardCents)}
            </span>
          </output>
          {preview.differenceCents > 0 && (
            <span className={styles.difference}>
              +{dollars(preview.differenceCents)} vs. the 50% start
            </span>
          )}
        </div>
      </div>
      <div className={styles.sliderArea}>
        <input
          id="reward-share"
          type="range"
          min="50"
          max="85"
          step="1"
          value={preview.share}
          onChange={(event) => setShare(event.currentTarget.valueAsNumber)}
          aria-describedby="slider-help slider-disclaimer"
          aria-valuetext={`${preview.share}% planned share, ${dollars(preview.rewardCents)} example reward, ${dollars(preview.differenceCents)} more than the starting level`}
        />
        <div className={styles.sliderEndpoints}>
          <span>50% · START</span>
          <span>85% · POTENTIAL MAX</span>
        </div>
      </div>
      <div className={styles.sliderPresets} aria-label="Try an example reward share">
        {[50, 60, 70, 75, 85].map((value) => (
          <button key={value} onClick={() => setShare(value)} aria-pressed={share === value}>
            {value}%
          </button>
        ))}
      </div>
      <p id="slider-help" className={styles.sliderHint}>
        Drag, tap or use the arrow keys. Same $1.48 activity, different planned shares.
      </p>
      <p id="slider-disclaimer" className={styles.calculatorDisclaimer}>
        Illustration only. Loyalty is in development. This does not calculate or change any live
        payout.
      </p>
    </div>
  );
}
const levels = [
  {
    share: 50,
    name: 'Start',
    text: 'A proposed place to begin. Find an activity that fits and start building your history.',
  },
  {
    share: 55,
    name: 'Explorer',
    text: 'Discover what works for you. Confirmed activities could contribute to future progression.',
  },
  {
    share: 60,
    name: 'Regular',
    text: 'A growing record. Return at your own pace, with your confirmed history in view.',
  },
  {
    share: 65,
    name: 'Steady',
    text: 'More history behind you. A proposed recognition of ongoing participation.',
  },
  {
    share: 70,
    name: 'Trusted',
    text: 'An established record. A future level for genuine, longer-term activity.',
  },
  {
    share: 75,
    name: 'Plus',
    text: 'A bigger proposed share. The requirements for this future level are still being designed.',
  },
  {
    share: 80,
    name: 'Prime',
    text: 'A substantial history. A potential milestone on the way to the highest illustrated level.',
  },
  {
    share: 85,
    name: 'Max',
    text: 'Up to 85% is the highest share being explored. It is a possibility, not a promised rate or a level you can unlock today.',
  },
];
export function PlannedLevels() {
  const [selected, setSelected] = useState(0);
  return (
    <div className={styles.levelExplorer}>
      <div className={styles.levelTrack} role="group" aria-label="Explore planned reward levels">
        {levels.map((level, index) => (
          <button
            key={level.share}
            aria-pressed={selected === index}
            aria-label={`${level.name}, ${level.share}% proposed share`}
            onClick={() => setSelected(index)}
          >
            <span className={styles.levelPercent}>
              {level.share}
              <span>%</span>
            </span>
            <span className={styles.levelNode} aria-hidden="true">
              {selected === index ? '↗' : '·'}
            </span>
            <span className={styles.levelName}>{level.name}</span>
          </button>
        ))}
      </div>
      <div className={styles.levelDetail} aria-live="polite">
        <div>
          <span>PROPOSED LEVEL / 0{selected + 1}</span>
          <h3>
            {levels[selected].name} <span>{levels[selected].share}%</span>
          </h3>
        </div>
        <p>{levels[selected].text}</p>
        <span className={styles.plannedTag}>PLANNED</span>
      </div>
    </div>
  );
}
