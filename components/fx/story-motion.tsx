'use client';
import { useEffect, useRef, useState } from 'react';
export function StoryMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const assembly = element.querySelector<HTMLElement>('.assembly-chapter');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!assembly) return;
      const rect = assembly.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, (window.innerHeight * 0.6 - rect.top) / (rect.height * 0.65)),
      );
      assembly.style.setProperty('--assembly', String(media.matches || paused ? 1 : progress));
    };
    const scroll = () => {
      if (media.matches || paused) return;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const preference = () => {
      element.dataset.motion = media.matches || paused ? 'paused' : 'active';
      if (media.matches || paused) assembly?.style.setProperty('--assembly', '1');
      scroll();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-seen');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    element.querySelectorAll('[data-reveal]').forEach((item) => observer.observe(item));
    preference();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    media.addEventListener('change', preference);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      media.removeEventListener('change', preference);
      cancelAnimationFrame(frame);
    };
  }, [paused]);
  return (
    <div className="story-root" ref={root}>
      <button className="motion-toggle" aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? 'Motion paused' : 'Pause motion'}{' '}
        <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
      </button>
      {children}
    </div>
  );
}
