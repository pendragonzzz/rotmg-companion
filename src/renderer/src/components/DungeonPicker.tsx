import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Character } from '../../../shared/types';
import { buildGoals, goalDungeonIds } from '../../../shared/engine';
import { verdictMap, type SourceStatus } from '../../../shared/planner';
import type { OverlaySettings } from '../../../shared/overlay';
import type { Location } from '../../../shared/location';
import { classMax, dungeonById, dungeons, exaltation, goalCtx, placeIndex, plannerData } from '../gameData';
import { STAT_LABEL } from '../labels';
import { Icon, type IconName } from './Icon';

/** Sentinel row id that clears the current location. */
const CLEAR = '__clear__';
const PLACE_ICON: Record<string, IconName> = { nexus: 'portal', realm: 'map', vault: 'chest', hub: 'pin' };

/**
 * Command-palette location chooser over the game: Nexus / Realm / Vault / hubs, then
 * dungeons with ★ favorites and an auto "For your goals" group; full keyboard control
 * (↑/↓, Enter, Esc). Each pick also teaches the log-based detection what to look for.
 */
export function DungeonPicker({
  settings,
  character,
  location = null,
  onClose,
}: {
  settings: OverlaySettings;
  character: Character | null;
  location?: Location | null;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const verdicts = useMemo(() => (character ? verdictMap(character, plannerData) : null), [character]);
  // Dungeons the active character's goals point at — auto-pinned at the top.
  const goalIds = useMemo(
    () => (character ? goalDungeonIds(buildGoals(character, dungeons, classMax, goalCtx, 6), dungeons) : []),
    [character],
  );
  const favSet = useMemo(() => new Set(settings.favorites), [settings.favorites]);
  const goalSet = useMemo(() => new Set(goalIds), [goalIds]);

  const places = useMemo(() => placeIndex.places.filter((p) => p.kind !== 'dungeon'), []);
  const currentId = location?.placeId ?? settings.currentDungeon;

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (ql) {
      const hit = (names: string[]) => names.some((n) => n.toLowerCase().includes(ql));
      return [
        {
          label: null,
          ids: [
            ...places.filter((p) => hit(p.names)).map((p) => p.id),
            ...placeIndex.places.filter((p) => p.kind === 'dungeon' && hit(p.names)).map((p) => p.id),
          ],
        },
      ];
    }
    const favOnly = settings.favorites.filter((f) => !goalSet.has(f) && dungeonById.has(f));
    const rest = dungeons.filter((d) => !goalSet.has(d.id) && !favSet.has(d.id)).map((d) => d.id);
    return [
      ...(currentId ? [{ label: null, ids: [CLEAR] }] : []),
      { label: 'Places', ids: places.map((p) => p.id) },
      { label: 'For your goals', ids: goalIds },
      { label: 'Favorites', ids: favOnly },
      { label: 'All dungeons', ids: rest },
    ].filter((g) => g.ids.length);
  }, [q, places, goalIds, goalSet, favSet, settings.favorites, currentId]);

  const flat = useMemo(() => groups.flatMap((g) => g.ids), [groups]);
  useEffect(() => setCursor(0), [q]);
  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.ov-picker-row.cursor')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pick = (id: string) => {
    window.api.overlay.setLocation(id === CLEAR ? null : id).catch(() => {});
    onClose();
  };
  const toggleFav = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const next = favSet.has(id) ? settings.favorites.filter((f) => f !== id) : [...settings.favorites, id];
    window.api.overlay.setSettings({ favorites: next }).catch(() => {});
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter' && flat[cursor]) pick(flat[cursor]!);
  };

  return (
    <div className="ov-picker-backdrop" onMouseDown={onClose}>
      <div className="ov-picker" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ov-picker-search">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Where are you? Nexus, Realm, a dungeon…"
            spellCheck={false}
          />
          <span className="ov-picker-keys">
            <kbd>↑↓</kbd> <kbd>Enter</kbd> <kbd>Esc</kbd>
          </span>
        </div>
        <div className="ov-picker-list" ref={listRef}>
          {groups.map((g, gi) => (
            <Fragment key={g.label ?? `g${gi}`}>
              {g.label && <div className="ov-picker-hdr">{g.label}</div>}
              {g.ids.map((id) => {
                const isCursor = flat[cursor] === id;
                if (id === CLEAR) {
                  return (
                    <button key={id} className={`ov-picker-row clear ${isCursor ? 'cursor' : ''}`} onClick={() => pick(id)}>
                      <Icon name="trash" size={13} />
                      <span className="ov-picker-name">Clear location</span>
                    </button>
                  );
                }
                const place = placeIndex.byId.get(id);
                if (place && place.kind !== 'dungeon') {
                  return (
                    <button
                      key={id}
                      className={`ov-picker-row place ${currentId === id ? 'current' : ''} ${isCursor ? 'cursor' : ''}`}
                      onClick={() => pick(id)}
                      onMouseEnter={() => setCursor(flat.indexOf(id))}
                    >
                      <Icon name={PLACE_ICON[place.kind] ?? 'pin'} size={13} />
                      <span className="ov-picker-name">{place.name}</span>
                      <span className="set-badge">{place.kind}</span>
                    </button>
                  );
                }
                const d = dungeonById.get(id);
                if (!d) return null;
                const fav = favSet.has(id);
                const status: SourceStatus = verdicts?.get(id) ?? 'unknown';
                const ex = exaltation.dungeons[id];
                return (
                  <button
                    key={id}
                    className={`ov-picker-row ${currentId === id ? 'current' : ''} ${isCursor ? 'cursor' : ''}`}
                    onClick={() => pick(id)}
                    onMouseEnter={() => setCursor(flat.indexOf(id))}
                  >
                    <span className={`ov-star ${fav ? 'on' : ''}`} onClick={(e) => toggleFav(id, e)} title={fav ? 'Unfavorite' : 'Favorite'}>
                      {fav ? '★' : '☆'}
                    </span>
                    <span className={`status-dot st-${status}`} />
                    <span className="ov-picker-name">{d.name}</span>
                    {ex && <span className="exalt-mini">{ex.stats.map((s) => STAT_LABEL[s]).join('/')}</span>}
                    <span className={`set-badge diff diff-cat-${d.category}`}>{d.category}</span>
                  </button>
                );
              })}
            </Fragment>
          ))}
          {flat.length === 0 && <div className="ov-picker-empty">No match</div>}
        </div>
      </div>
    </div>
  );
}
