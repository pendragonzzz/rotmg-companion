import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Character } from '../../../shared/types';
import { buildGoals, goalDungeonIds } from '../../../shared/engine';
import { verdictMap, type SourceStatus } from '../../../shared/planner';
import type { OverlaySettings } from '../../../shared/overlay';
import { classMax, dungeonById, dungeons, exaltation, goalCtx, plannerData } from '../gameData';
import { STAT_LABEL } from '../labels';
import { Icon } from './Icon';

/** Sentinel row id that clears the current dungeon. */
const CLEAR = '__clear__';

/**
 * Command-palette dungeon chooser over the game: search, ★ favorites, an auto
 * "For your goals" group, and full keyboard control (↑/↓, Enter, Esc).
 */
export function DungeonPicker({
  settings,
  character,
  onClose,
}: {
  settings: OverlaySettings;
  character: Character | null;
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

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (ql) {
      return [{ label: null, ids: dungeons.filter((d) => d.name.toLowerCase().includes(ql)).map((d) => d.id) }];
    }
    const favOnly = settings.favorites.filter((f) => !goalSet.has(f) && dungeonById.has(f));
    const rest = dungeons.filter((d) => !goalSet.has(d.id) && !favSet.has(d.id)).map((d) => d.id);
    return [
      ...(settings.currentDungeon ? [{ label: null, ids: [CLEAR] }] : []),
      { label: 'For your goals', ids: goalIds },
      { label: 'Favorites', ids: favOnly },
      { label: 'All dungeons', ids: rest },
    ].filter((g) => g.ids.length);
  }, [q, goalIds, goalSet, favSet, settings.favorites, settings.currentDungeon]);

  const flat = useMemo(() => groups.flatMap((g) => g.ids), [groups]);
  useEffect(() => setCursor(0), [q]);
  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.ov-picker-row.cursor')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pick = (id: string) => {
    window.api.overlay.setSettings({ currentDungeon: id === CLEAR ? '' : id }).catch(() => {});
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
            placeholder="Search dungeons…"
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
                      <span className="ov-picker-name">Clear current dungeon</span>
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
                    className={`ov-picker-row ${settings.currentDungeon === id ? 'current' : ''} ${isCursor ? 'cursor' : ''}`}
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
