import { useMemo, useState } from 'react';
import type { STSet } from '../../../shared/engine';
import { dungeonById, sets } from '../gameData';
import { Dropdown } from './Dropdown';
import { Icon } from './Icon';
import { ClassSprite } from './ui';

const dungeonName = new Map([...dungeonById].map(([id, d]) => [id, d.name]));

const DIFFICULTY_ORDER: Record<string, number> = { starter: 0, low: 1, mid: 2, high: 3, endgame: 4, other: 5 };
const DIFFICULTY_LABEL: Record<string, string> = {
  starter: 'Starter', low: 'Low', mid: 'Mid', high: 'High', endgame: 'Endgame', other: 'Other / Event',
};

function diffKey(s: STSet): string {
  return s.difficultyCategory ?? 'other';
}

export function SetsPage({ initialClass }: { initialClass?: string }) {
  const [classFilter, setClassFilter] = useState(initialClass ?? 'all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [q, setQ] = useState('');

  const classes = useMemo(
    () => [...new Set(sets.map((s) => s.className))].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const diffs = useMemo(
    () => [...new Set(sets.map(diffKey))].sort((a, b) => (DIFFICULTY_ORDER[a] ?? 9) - (DIFFICULTY_ORDER[b] ?? 9)),
    [],
  );

  const shown = useMemo(() => {
    return sets
      .filter((s) => classFilter === 'all' || s.className === classFilter)
      .filter((s) => diffFilter === 'all' || diffKey(s) === diffFilter)
      .filter((s) => {
        const ql = q.trim().toLowerCase();
        return !ql || s.name.toLowerCase().includes(ql) || s.members.some((m) => m.name.toLowerCase().includes(ql));
      })
      .sort(
        (a, b) =>
          (DIFFICULTY_ORDER[diffKey(a)] ?? 9) - (DIFFICULTY_ORDER[diffKey(b)] ?? 9) ||
          a.className.localeCompare(b.className) ||
          a.name.localeCompare(b.name),
      );
  }, [classFilter, diffFilter, q]);

  if (sets.length === 0) {
    return (
      <div className="hint">
        <p>No set data yet.</p>
        <p className="muted">Run <code>npm run refresh</code> to scrape ST sets from RealmEye.</p>
      </div>
    );
  }

  const classOpts = [{ value: 'all', label: 'All classes' }, ...classes.map((c) => ({ value: c, label: c }))];
  const diffOpts = [
    { value: 'all', label: 'All difficulties' },
    ...diffs.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] ?? d })),
  ];

  return (
    <>
      <div className="toolbar">
        <div className="sets-filters">
          <span className="search-field">
            <Icon name="search" size={14} className="search-ico" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sets or pieces…" spellCheck={false} />
          </span>
          <Dropdown label="Class" value={classFilter} options={classOpts} onChange={setClassFilter} />
          <Dropdown label="Difficulty" value={diffFilter} options={diffOpts} onChange={setDiffFilter} />
          <span className="char-count">{shown.length} sets</span>
        </div>
      </div>
      <div className="sets-grid">
        {shown.map((s) => (
          <SetCard key={s.slug} set={s} />
        ))}
      </div>
    </>
  );
}

function SetCard({ set }: { set: STSet }) {
  const diff = diffKey(set);
  const where = (m: STSet['members'][number]) =>
    (m.dungeonId && dungeonName.get(m.dungeonId)) ||
    (set.sourceDungeonIds[0] && dungeonName.get(set.sourceDungeonIds[0])) ||
    null;
  return (
    <section className="set-card" data-class={set.className.toLowerCase()}>
      <header className="set-card-head row">
        <ClassSprite className={set.className} size={28} />
        <div className="set-title-wrap">
          <div className="set-title">{set.name}</div>
          <div className="set-badges">
            <span className="set-badge cls">{set.className}</span>
            {set.generation && <span className="set-badge gen">{set.generation.replace(' Generation', ' Gen')}</span>}
            <span className={`set-badge diff diff-cat-${diff}`}>{DIFFICULTY_LABEL[diff] ?? diff}</span>
          </div>
        </div>
      </header>

      <div className="set-members">
        {set.members.map((m) => (
          <div key={m.slug} className="set-member" title={m.description ?? ''}>
            <span className="set-slot">{m.slot.toUpperCase()}</span>
            <span className="set-member-name">{m.name}</span>
            {m.summary && <span className="set-member-stats">{m.summary}</span>}
            {where(m) && <span className="set-member-where">📍 {where(m)}</span>}
          </div>
        ))}
      </div>

      {set.sourceDungeonIds.length === 0 && set.sources.length > 0 && (
        <div className="set-source">📍 Drops from: {set.sources.slice(0, 4).join(', ')}</div>
      )}

      {(set.bonuses.two || set.bonuses.three || set.bonuses.four) && (
        <div className="set-bonuses">
          {set.bonuses.two && <div className="set-bonus"><span className="pc">2-pc</span> {set.bonuses.two.text}</div>}
          {set.bonuses.three && <div className="set-bonus"><span className="pc">3-pc</span> {set.bonuses.three.text}</div>}
          {set.bonuses.four && <div className="set-bonus"><span className="pc full">4-pc</span> {set.bonuses.four.text}</div>}
        </div>
      )}
    </section>
  );
}
