import type { CSSProperties, ReactNode } from 'react';
export type IconName =
  | 'home'
  | 'spark'
  | 'wallet'
  | 'reward'
  | 'activity'
  | 'settings'
  | 'help'
  | 'survey'
  | 'game'
  | 'gift'
  | 'task'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'close'
  | 'check'
  | 'plus'
  | 'minus'
  | 'clock'
  | 'mobile'
  | 'desktop'
  | 'filter'
  | 'external'
  | 'lock'
  | 'mail'
  | 'logout'
  | 'download'
  | 'refresh'
  | 'warning'
  | 'wifi'
  | 'eye'
  | 'eye-off'
  | 'sun'
  | 'leaf';
const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  spark: <path d="m14 2-7 9H2l8 5-1 6 7-9h6l-8-5Z" />,
  wallet: (
    <>
      <path d="M20 8V5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16V8H4a1.5 1.5 0 0 1 0-3" />
      <path d="M20 12h-6v5h6" />
      <path d="M16 14.5h.1" />
    </>
  ),
  reward: (
    <>
      <path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="15" cy="17" r="3" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8.5a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1-1 2.2M12 17h.01" />
    </>
  ),
  survey: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  game: (
    <>
      <path d="M8 7h8c3 0 4 3 5 9 .5 3-2 4-4 2l-2-2H9l-2 2c-2 2-4.5 1-4-2 1-6 2-9 5-9Z" />
      <path d="M6 11h4M8 9v4M16 11h.01M18 13h.01" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8c-8 0-7-7-3-5 2 1 3 5 3 5Zm0 0c8 0 7-7 3-5-2 1-3 5-3 5Z" />
    </>
  ),
  task: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="m8 9 2 2 5-5M8 16h8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4ZM10 20h4" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  desktop: (
    <>
      <rect x="3" y="3" width="18" height="13" rx="2" />
      <path d="M12 16v5M7 21h10" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7M21 3l-10 10M10 3H3v18h18v-7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  logout: (
    <>
      <path d="M10 3H3v18h7M8 12h13m-5-5 5 5-5 5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2 21h20ZM12 9v5M12 17h.01" />
    </>
  ),
  wifi: (
    <>
      <path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 20h.01M3 3l18 18" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M3 3 21 21M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-1 6-2M10 5h2c6 0 10 7 10 7l-3 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  leaf: (
    <>
      <path d="M19 3C8 2 2 8 6 15s15 4 13-12ZM5 20l10-11" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function Spark({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M36 3 19 26H3l23 14-3 21 18-24h20L38 23Z" />
    </svg>
  );
}
