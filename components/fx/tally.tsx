import type { CSSProperties } from 'react';

/** Original Freearn vector: individual marks become ascending steps. */
export function TallyMark({ size = 72, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {[3, 5, 7].map((count, column) =>
        Array.from({ length: count }, (_, row) => (
          <rect
            key={`${column}-${row}`}
            x={4 + column * 31}
            y={80 - row * 11}
            width="25"
            height="7"
          />
        )),
      )}
    </svg>
  );
}
export function StripArt({
  category = 'games',
  className = '',
}: {
  category?: string;
  className?: string;
}) {
  return (
    <div className={`strip-art strip-${category} ${className}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} style={{ '--strip': i } as CSSProperties} />
      ))}
    </div>
  );
}
export function TallyMeter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="tally-meter"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {Array.from({ length: 20 }, (_, i) => (
        <span key={i} className={i * 5 < value ? 'filled' : ''} aria-hidden="true" />
      ))}
    </div>
  );
}
