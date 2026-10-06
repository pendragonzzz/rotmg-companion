import { useMemo, useState } from 'react';
import type { Character } from '../../../shared/types';
import type { Phase } from '../App';
import type { DeclinedApi, RecentApi } from '../hooks';
import type { Nav } from '../pages';
import { charKey } from '../activeChar';
import { dungeons, meta } from '../gameData';
import type { LiveState } from '../../../shared/live';
import { CharacterCard } from './CharacterCard';
import { ActivityFeed } from './Live';
import { ErrorBoundary } from './ErrorBoundary';
import { Icon, type IconName } from './Icon';
import { Segmented, StatTile } from './ui';

type SortKey = 'progress' | 'level' | 'fame' | 'class';
type FilterKey = 'all' | 'progress' | 'maxed';

const SORTS: Record<SortKey, (a: Character, b: Character) => number> = {
  progress: (a, b) => b.maxedCount - a.maxedCount || b.level - a.level || b.fame - a.fame,
  level: (a, b) => b.level - a.level || b.maxedCount - a.maxedCount,
  fame: (a, b) => b.fame - a.fame,
  class: (a, b) => a.className.localeCompare(b.className),
};

export function CharactersPage({
  phase,
  characters,
  active,
  onSelect,
  declined,
  recent,
  onLoad,
  nav,
  live,
  now,
}: {
  live: LiveState | null;
  now: number;
  phase: Phase;
  characters: Character[];
  active: Character | null;
  onSelect: (c: Character) => void;
  declined: DeclinedApi;
  recent: RecentApi;
  onLoad: (name: string) => void;
  nav: Nav;
}) {
  const [sort, setSort] = useState<SortKey>('progress');
  const [filter, setFilter] = useState<FilterKey>('all');

  const shown = useMemo(
    () =>
      characters
        .filter((c) => (filter === 'maxed' ? c.maxedCount === 8 : filter === 'progress' ? c.maxedCount < 8 : true))
        .sort(SORTS[sort]),
    [characters, sort, filter],
  );

  if (phase.kind === 'idle' || (phase.kind === 'loading' && !characters.length)) {
    return <Welcome phase={phase} recent={recent} onLoad={onLoad} nav={nav} />;
  }
  if (phase.kind === 'error') {
    return (
      <>
        <div className="error-box">{phase.message}</div>
        <Welcome phase={phase} recent={recent} onLoad={onLoad} nav={nav} />
      </>
    );
  }
  if (phase.kind !== 'loaded') return null;

  const { profile } = phase;
  if (profile.isPrivate) {
    return <div className="error-box">{profile.name}&apos;s profile is set to private on RealmEye.</div>;
  }
  if (!profile.characters.length) {
    return (
      <div className="hint">
        <p>
          <strong>{profile.name}</strong> has no active characters on RealmEye right now.
        </p>
        <p className="muted">New accounts often aren&apos;t indexed until linked on RealmEye.</p>
      </div>
    );
  }

  const s = profile.summary;
  const maxed = characters.filter((c) => c.maxedCount === 8).length;
  return (
    <>
      <div className="tiles">
        <StatTile label="Player" value={profile.name} sub={s.guild ? `Guild · ${s.guild}` : 'No guild'} tone="accent" />
        <StatTile label="Characters" value={characters.length} sub={`${maxed} at 8/8`} />
        {s.accountFame != null && <StatTile label="Account fame" value={s.accountFame.toLocaleString()} />}
        {s.exaltations != null && <StatTile label="Exaltations" value={s.exaltations.toLocaleString()} tone="good" />}
      </div>

      {live && <ActivityFeed live={live} now={now} characters={characters} onSelect={onSelect} />}

      <div className="toolbar">
        <Segmented<SortKey>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'progress', label: 'Progress' },
            { value: 'level', label: 'Level' },
            { value: 'fame', label: 'Fame' },
            { value: 'class', label: 'Class' },
          ]}
        />
        <Segmented<FilterKey>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${characters.length}` },
            { value: 'progress', label: `Maxing ${characters.length - maxed}` },
            { value: 'maxed', label: `8/8 ${maxed}` },
          ]}
        />
        <span className="toolbar-hint muted">Click a card to expand · ★ marks the active character</span>
      </div>

      <div className="cards">
        {shown.map((c) => (
          <ErrorBoundary key={charKey(c)} label={`${c.className} (Lv ${c.level})`}>
            <CharacterCard
              character={c}
              active={!!active && charKey(active) === charKey(c)}
              onActivate={() => onSelect(c)}
              declinedList={declined.listFor(c.className)}
              onDecline={(id) => declined.decline(c.className, id)}
              onRestore={(id) => declined.restore(c.className, id)}
              nav={nav}
            />
          </ErrorBoundary>
        ))}
      </div>
    </>
  );
}

const FEATURES: { icon: IconName; title: string; text: string; page: Parameters<Nav['go']>[0] }[] = [
  { icon: 'flask', title: 'Potion planner', text: 'Pots left per stat, the best dungeon you can run now, and a biome route.', page: 'potions' },
  { icon: 'att', title: 'Gear planner', text: 'Equipped vs best-now vs endgame best-in-slot, plus ST set progress.', page: 'gear' },
  { icon: 'castle', title: 'Dungeon encyclopedia', text: `Drops, pots, exalts, runes and the key mechanic for all ${dungeons.length} dungeons.`, page: 'dungeons' },
  { icon: 'layout', title: 'In-game overlay', text: 'A click-through HUD with your next goal and the dungeon you’re in.', page: 'overlay' },
];

function Welcome({ phase, recent, onLoad, nav }: { phase: Phase; recent: RecentApi; onLoad: (n: string) => void; nav: Nav }) {
  return (
    <div className="welcome">
      <div className="welcome-hero">
        <span className="welcome-mark">⚔</span>
        <div>
          <h2>Welcome, Realmer.</h2>
          <p className="muted">
            Type a <b>public RealmEye name</b> in the search bar (press <kbd>/</kbd>) to import your characters. Every
            page then plans for whichever character is active in the top-right switcher.
          </p>
          {phase.kind === 'loading' && <p className="loading-line">Loading {phase.name}…</p>}
        </div>
      </div>

      {recent.recent.length > 0 && (
        <div className="recent-row">
          <span className="muted">Recent:</span>
          {recent.recent.map((n) => (
            <button key={n} className="recent-chip" onClick={() => onLoad(n)}>
              {n}
              <span
                className="recent-x"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  recent.remove(n);
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <button key={f.title} className="feature" onClick={() => nav.go(f.page)}>
            <span className="feature-icon">
              <Icon name={f.icon} size={20} />
            </span>
            <span className="feature-title">{f.title}</span>
            <span className="feature-text">{f.text}</span>
          </button>
        ))}
      </div>
      <p className="muted small">
        Game data researched {meta.asOf} · {meta.current}
      </p>
    </div>
  );
}
