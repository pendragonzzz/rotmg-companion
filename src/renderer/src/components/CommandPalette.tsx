import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Character } from '../../../shared/types';
import { itemEntries, searchEntries, type SearchEntry, type SearchKind } from '../../../shared/search';
import { dungeonDrops, dungeonName, dungeons, placeIndex, sets, tierClass } from '../gameData';
import { PAGES, type Nav, type PageId } from '../pages';
import { THEMES } from '../hooks';
import { Icon, type IconName } from './Icon';

const KIND_ICON: Record<SearchKind, IconName> = {
  action: 'command',
  page: 'layout',
  character: 'user',
  place: 'portal',
  dungeon: 'castle',
  item: 'chest',
  set: 'sets',
};
const KIND_LABEL: Record<SearchKind, string> = {
  action: 'Action',
  page: 'Page',
  character: 'Character',
  place: 'Location',
  dungeon: 'Dungeon',
  item: 'Drops at',
  set: 'Set',
};

/** Ctrl+K: jump anywhere, run an action, or ask "where does X drop?". */
export function CommandPalette({
  onClose,
  characters,
  onSelectCharacter,
  nav,
  setTheme,
  hasProfile,
}: {
  onClose: () => void;
  characters: Character[];
  onSelectCharacter: (c: Character) => void;
  nav: Nav;
  setTheme: (t: string) => void;
  hasProfile: boolean;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  // Built once per open — the item index is ~400 entries, cheap.
  const entries = useMemo<SearchEntry[]>(() => {
    const actions: SearchEntry[] = [
      { id: 'act:overlay', kind: 'action', title: 'Show / hide the overlay', keywords: 'hud toggle', ref: 'overlay' },
      { id: 'act:where', kind: 'action', title: 'Pick where I am (over the game)', keywords: 'location quick-pick nexus realm dungeon', ref: 'picker' },
      ...(hasProfile ? [{ id: 'act:sync', kind: 'action' as const, title: 'Check RealmEye now', keywords: 'refresh sync reload f5', ref: 'sync' }] : []),
      ...THEMES.map((t) => ({ id: `theme:${t.value}`, kind: 'action' as const, title: `Theme: ${t.label}`, keywords: 'color dark light', ref: `theme:${t.value}` })),
    ];
    const pages: SearchEntry[] = PAGES.map((p) => ({ id: `page:${p.id}`, kind: 'page', title: p.label, sub: p.blurb, ref: p.id }));
    const chars: SearchEntry[] = characters.map((c, i) => ({
      id: `char:${i}`,
      kind: 'character',
      title: c.className,
      sub: `${c.statsMaxed} · Lv ${c.level} · ${c.fame.toLocaleString()} fame`,
      ref: String(i),
    }));
    const places: SearchEntry[] = placeIndex.places
      .filter((p) => p.kind !== 'dungeon')
      .map((p) => ({ id: `place:${p.id}`, kind: 'place', title: `I'm in: ${p.name}`, sub: 'Set the overlay location', keywords: p.names.join(' '), ref: p.id }));
    const dungeonRows: SearchEntry[] = dungeons.map((d) => ({
      id: `dungeon:${d.id}`,
      kind: 'dungeon',
      title: d.name,
      sub: `${d.category} · T${d.tier}`,
      keywords: placeIndex.byId.get(d.id)?.names.join(' '),
      ref: d.id,
    }));
    const setRows: SearchEntry[] = sets.map((s) => ({
      id: `set:${s.slug}`,
      kind: 'set',
      title: s.name,
      sub: `${s.className} · ${s.difficultyCategory}`,
      keywords: s.members.map((m) => m.name).join(' '),
      ref: s.className,
    }));
    return [...actions, ...pages, ...chars, ...places, ...dungeonRows, ...itemEntries(dungeonDrops, dungeonName), ...setRows];
  }, [characters, hasProfile]);

  const results = useMemo(() => {
    if (!q.trim()) return entries.filter((e) => e.kind === 'action' || e.kind === 'page').slice(0, 14);
    return searchEntries(entries, q, 40);
  }, [entries, q]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.cmdk-row.cursor')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const run = (e: SearchEntry) => {
    onClose();
    switch (e.kind) {
      case 'page':
        return nav.go(e.ref as PageId);
      case 'dungeon':
      case 'item':
        return nav.openDungeon(e.ref);
      case 'set':
        return nav.browseSets(e.ref);
      case 'character': {
        const c = characters[Number(e.ref)];
        if (c) onSelectCharacter(c);
        return;
      }
      case 'place':
        return void window.api.overlay.setLocation(e.ref).catch(() => {});
      case 'action':
        if (e.ref === 'overlay') return void window.api.overlay.toggle().catch(() => {});
        if (e.ref === 'picker') return void window.api.overlay.setPicker(true).catch(() => {});
        if (e.ref === 'sync') return void window.api.live.syncNow().catch(() => {});
        if (e.ref.startsWith('theme:')) return setTheme(e.ref.slice(6));
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter' && results[cursor]) run(results[cursor]!);
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={onClose}>
      <div className="cmdk" role="dialog" aria-label="Search everything" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search pages, dungeons, items (where does it drop?), sets, actions…"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {!q.trim() && <div className="cmdk-hint">Try “spectral sword”, “septavius”, “o3”, “theme”, “nexus”…</div>}
          {results.map((e, i) => (
            <button
              key={e.id}
              className={`cmdk-row ${i === cursor ? 'cursor' : ''}`}
              onClick={() => run(e)}
              onMouseEnter={() => setCursor(i)}
            >
              <Icon name={KIND_ICON[e.kind]} size={15} className="cmdk-ico" />
              <span className="cmdk-main">
                <span className="cmdk-title">
                  {e.tier && <span className={`tier tier-${tierClass(e.tier)}`}>{e.tier}</span>}
                  {e.title}
                </span>
                {e.sub && <span className="cmdk-sub">{e.sub}</span>}
              </span>
              <span className="cmdk-kind">{KIND_LABEL[e.kind]}</span>
            </button>
          ))}
          {q.trim() && results.length === 0 && <div className="cmdk-hint">No match for “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
