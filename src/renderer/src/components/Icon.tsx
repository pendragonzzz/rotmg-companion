import type { StatKey } from '../../../shared/types';

/**
 * Inline-SVG icon set (stroke = currentColor) so icons inherit text color and
 * theme without any external assets — important under our strict CSP.
 */
const PATHS: Record<string, JSX.Element> = {
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
};

const STAT_ICONS: Record<StatKey, string> = {
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
