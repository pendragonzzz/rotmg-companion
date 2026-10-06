import type { StatKey } from '../../../shared/types';

/**
 * Inline-SVG icon set (stroke = currentColor) so icons inherit text color and
 * theme without any external assets — important under our strict CSP.
 */
const PATHS = {
  // --- stats ---
  hp: <path d="M20.8 5.6a5 5 0 0 0-8-1.3L12 5l-.8-.7a5 5 0 0 0-8 5.4C4 14 12 20 12 20s8-6 8.8-10.3a5 5 0 0 0 0-4.1z" />,
  mp: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  att: (
    <>
      <path d="M14.5 17.5 4 7V4h3l10.5 10.5" />
      <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
    </>
  ),
  def: <path d="M12 21s7-3.2 7-9V6l-7-3-7 3v6c0 5.8 7 9 7 9z" />,
  spd: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  dex: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
    </>
  ),
  vit: (
    <>
      <path d="M7 20h10" />
      <path d="M12 20c0-6 0-9 4-12-3 0-6 1-7 5-1-3-3-4-6-4 2 4 5 5 9 5" />
    </>
  ),
  wis: <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5V4.5zM5 19.5A2.5 2.5 0 0 1 7.5 17H19" />,
  // --- ui ---
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21" />
      <circle cx="12" cy="7.5" r="4" />
    </>
  ),
  sets: <path d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5" />,
  exalt: <path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9l2-6.5z" />,
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  leaf: <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 22c2.5-4 5.5-6.5 9-8" />,
  chest: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M3 8l2-4h14l2 4M3 12h18M11 12v3h2v-3" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  paw: (
    <>
      <circle cx="6" cy="11" r="1.9" />
      <circle cx="10.3" cy="7.2" r="1.9" />
      <circle cx="13.7" cy="7.2" r="1.9" />
      <circle cx="18" cy="11" r="1.9" />
      <path d="M8.2 15.2c1-1 1.8-1.7 3.8-1.7s2.8.7 3.8 1.7c1.6 1.6 1.3 4-1 4-1.1 0-1.9-.5-2.8-.5s-1.7.5-2.8.5c-2.3 0-2.6-2.4-1-4z" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6.2L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.2V3" />
      <path d="M7.3 15h9.4" />
    </>
  ),
  castle: (
    <>
      <path d="M4 21V9h3V6h2v3h2V4h2v5h2V6h2v3h3v12z" />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 15.7" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8L21 8.3" />
      <path d="M21 3v5.3h-5.3M3 21v-5.3h5.3" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4.5M12 8h.01" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
    </>
  ),
  /** Nexus: a portal ring. */
  portal: (
    <>
      <ellipse cx="12" cy="12" rx="6.5" ry="9" />
      <ellipse cx="12" cy="12" rx="3" ry="5" />
    </>
  ),
  /** Realm: a map. */
  map: <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14" />,
  /** Command palette. */
  command: (
    <>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

const STAT_ICONS: Record<StatKey, IconName> = {
  hp: 'hp', mp: 'mp', att: 'att', def: 'def', spd: 'spd', dex: 'dex', vit: 'vit', wis: 'wis',
};

export function Icon({
  name,
  size = 16,
  className,
  filled,
}: {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** A stat glyph (heart/sword/shield…) for the given stat key. */
export function StatIcon({ stat, size = 14, className }: { stat: StatKey; size?: number; className?: string }) {
  return <Icon name={STAT_ICONS[stat]} size={size} className={className} />;
}
