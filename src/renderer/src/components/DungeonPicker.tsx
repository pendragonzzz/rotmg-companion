import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Character } from '../../../shared/types';
import {
  buildGoals,
  goalDungeonIds,
  type DungeonGate,
  type ClassMaxTable,
  type DungeonDropTable,
  type StatPriority,
  type PotRouting,
  type BiomeData,
  type ExaltationData,
} from '../../../shared/engine';
import type { OverlaySettings } from '../../../shared/overlay';
import dungeonsData from '../../../shared/data/dungeons.json';
import classMaxData from '../../../shared/data/class-max-stats.json';
import dungeonDropsData from '../../../shared/data/dungeon-drops.json';
import statPriorityData from '../../../shared/data/stat-priority.json';
import potRoutingData from '../../../shared/data/pot-routing.json';
import biomesData from '../../../shared/data/biomes.json';
import exaltationData from '../../../shared/data/exaltation.json';
import { Icon } from './Icon';

const dungeons = dungeonsData as DungeonGate[];
const byId = new Map(dungeons.map((d) => [d.id, d]));
const classMax = classMaxData as ClassMaxTable;
const ctx = {
  dungeonDrops: dungeonDropsData as DungeonDropTable,
  statPriority: statPriorityData as StatPriority,
  potRouting: potRoutingData as unknown as PotRouting,
  biomes: biomesData as unknown as BiomeData,
  exaltation: exaltationData as unknown as ExaltationData,
};

/** Command-palette dungeon chooser over the game: search + ★ favorites + auto "For your goals". */
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
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  // Dungeons the active character's goals point at — auto-pinned at the top.
  const goalIds = useMemo(
    () => (character ? goalDungeonIds(buildGoals(character, dungeons, classMax, ctx, 6), dungeons) : []),
    [character],
  );

  const favSet = useMemo(() => new Set(settings.favorites), [settings.favorites]);
  const goalSet = useMemo(() => new Set(goalIds), [goalIds]);

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (ql) {
      return [{ label: null, ids: dungeons.filter((d) => d.name.toLowerCase().includes(ql)).map((d) => d.id) }];
    }
    const favOnly = settings.favorites.filter((f) => !goalSet.has(f));
    const rest = dungeons.filter((d) => !goalSet.has(d.id) && !favSet.has(d.id)).map((d) => d.id);
    return [
      { label: 'For your goals', ids: goalIds },
      { label: 'Favorites', ids: favOnly },
      { label: 'All dungeons', ids: rest },
    ].filter((g) => g.ids.length);
  }, [q, goalIds, goalSet, favSet, settings.favorites]);

  const firstId = groups[0]?.ids[0];

  const pick = (id: string) => {
    window.api.overlay.setSettings({ currentDungeon: id }).catch(() => {});
    onClose();
  };
  const toggleFav = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    const next = favSet.has(id) ? settings.favorites.filter((f) => f !== id) : [...settings.favorites, id];
    window.api.overlay.setSettings({ favorites: next }).catch(() => {});
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter' && firstId) pick(firstId);
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
            placeholder="Search dungeons…  (Enter = pick, Esc = close)"
            spellCheck={false}
          />
        </div>
        <div className="ov-picker-list">
          {groups.map((g) => (
            <Fragment key={g.label ?? 'results'}>
              {g.label && <div className="ov-picker-hdr">{g.label}</div>}
              {g.ids.map((id) => {
                const d = byId.get(id);
                if (!d) return null;
                const fav = favSet.has(id);
                return (
                  <button
                    key={id}
                    className={`ov-picker-row ${settings.currentDungeon === id ? 'current' : ''}`}
                    onClick={() => pick(id)}
                  >
                    <span
                      className={`ov-star ${fav ? 'on' : ''}`}
                      onClick={(e) => toggleFav(id, e)}
                      title={fav ? 'Unfavorite' : 'Favorite'}
                    >
                      {fav ? '★' : '☆'}
                    </span>
                    {goalSet.has(id) && <span className="ov-goal-pin" title="From your goals" />}
                    <span className="ov-picker-name">{d.name}</span>
                    <span className={`set-badge diff diff-cat-${d.category}`}>{d.category}</span>
                  </button>
                );
              })}
            </Fragment>
          ))}
          {groups.length === 0 && <div className="ov-picker-empty">No match</div>}
        </div>
      </div>
    </div>
  );
}
