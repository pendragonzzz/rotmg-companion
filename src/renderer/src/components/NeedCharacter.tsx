import type { Phase } from '../App';
import type { RecentApi } from '../hooks';
import type { PageDef } from '../pages';
import { EmptyState } from './ui';

/** Shown on character-driven pages (Potions, Gear) until a player is loaded. */
export function NeedCharacter({
  page,
  phase,
  recent,
  onLoad,
}: {
  page: PageDef;
  phase: Phase;
  recent: RecentApi;
  onLoad: (name: string) => void;
}) {
  return (
    <EmptyState icon={page.icon} title={`Load a player to plan ${page.label.toLowerCase()}`}>
      <p className="muted">
        {page.label} plans are built for one character at a time. Type a public RealmEye name in the search bar
        (press <kbd>/</kbd>), then pick the character in the top-right switcher.
      </p>
      {phase.kind === 'loading' && <p className="muted">Loading {phase.name}…</p>}
      {phase.kind === 'error' && <div className="error-box">{phase.message}</div>}
      {recent.recent.length > 0 && (
        <div className="recent-row center">
          {recent.recent.map((n) => (
            <button key={n} className="recent-chip" onClick={() => onLoad(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </EmptyState>
  );
}
