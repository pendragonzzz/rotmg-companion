import { useMemo } from 'react';
import type { Character } from '../../../shared/types';
import {
  buildGoals,
  evaluateReadiness,
  recommendSetFor,
  type DungeonGate,
  type ClassMaxTable,
  type DungeonDropTable,
  type StatPriority,
  type PotRouting,
  type BiomeData,
  type ExaltationData,
  type SetTable,
} from '../../../shared/engine';
import type { OverlaySettings } from '../../../shared/overlay';
import dungeonsData from '../../../shared/data/dungeons.json';
import classMaxData from '../../../shared/data/class-max-stats.json';
import dungeonDropsData from '../../../shared/data/dungeon-drops.json';
import statPriorityData from '../../../shared/data/stat-priority.json';
import potRoutingData from '../../../shared/data/pot-routing.json';
import biomesData from '../../../shared/data/biomes.json';
import exaltationData from '../../../shared/data/exaltation.json';
import setsData from '../../../shared/data/sets.json';
import { Icon } from './Icon';
import { classIcon } from '../classIcons';
import { beaconForBiome, biomeName } from '../beacons';
import { STAT_LABEL } from '../labels';

const dungeons = dungeonsData as DungeonGate[];
const dungeonName = new Map(dungeons.map((d) => [d.id, d.name]));
const dungeonById = new Map(dungeons.map((d) => [d.id, d]));
const tierCls = (t: string) => (t === 'ST' ? 'st' : t === 'UT' ? 'ut' : 't');
const classMax = classMaxData as ClassMaxTable;
const dungeonDrops = dungeonDropsData as DungeonDropTable;
const statPriority = statPriorityData as StatPriority;
const potRouting = potRoutingData as unknown as PotRouting;
const biomes = biomesData as unknown as BiomeData;
const exaltation = exaltationData as unknown as ExaltationData;
const sets = setsData as unknown as SetTable;

export function OverlayHud({
  character,
  settings,
}: {
  character: Character | null;
  settings: OverlaySettings;
}) {
  const goals = useMemo(
    () =>
      character
        ? buildGoals(
            character,
            dungeons,
            classMax,
            { dungeonDrops, statPriority, potRouting, biomes, exaltation },
            settings.maxGoals,
          )
        : [],
    [character, settings.maxGoals],
  );
  const recSet = useMemo(() => {
    if (!character) return null;
    const r = evaluateReadiness(character, dungeons, classMax, statPriority);
    const verdictById = new Map(r.verdicts.map((v) => [v.id, v.status]));
    return recommendSetFor(character, sets, verdictById);
  }, [character]);

  // The headline "go here next": biome (+ beacon color) and the dungeon to enter.
  const target = useMemo(() => {
    const g = goals[0];
    if (!g) return null;
    let biomeId = g.biome;
    const dungeon = g.sources?.[0]?.name ?? (g.where ? g.where.split(',')[0]!.trim() : undefined);
    if (!biomeId && g.where) {
      biomeId = dungeons.find((d) => d.name === g.where!.split(',')[0]!.trim())?.biome;
    }
    if (!biomeId && !dungeon) return null;
    return { biomeId, beacon: beaconForBiome(biomeId), dungeon };
  }, [goals]);

  // All distinct beacons the character should farm at (across goals), with what each gives.
  const beacons = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; color: string; label: string; pots: string }[] = [];
    for (const g of goals) {
      if (!g.biome || seen.has(g.biome)) continue;
      const bi = beaconForBiome(g.biome);
      if (!bi) continue;
      seen.add(g.biome);
      const pots = (biomes.biomes[g.biome]?.statPots ?? []).map((s) => STAT_LABEL[s]).join('/');
      out.push({ id: g.biome, name: biomeName(g.biome), color: bi.color, label: bi.label, pots });
    }
    return out.slice(0, 4);
  }, [goals]);

  if (!character) {
    return <div className="ov-hud ov-empty">Pick an active character in the app →</div>;
  }

  const w = settings.widgets;
  const icon = classIcon(character.className);
  const curDungeon = settings.currentDungeon ? dungeonById.get(settings.currentDungeon) : undefined;
  const curDrops = curDungeon ? (dungeonDrops[curDungeon.id]?.gear ?? []).slice(0, 4) : [];

  return (
    <div className="ov-hud" style={{ transform: `scale(${settings.scale})`, opacity: settings.opacity }}>
      {w.header && (
        <div className="ov-head">
          {icon ? (
            <img className="class-sprite sm" src={icon} alt="" width={24} height={24} />
          ) : (
            <span className="class-sprite sm mono">{character.className.slice(0, 2)}</span>
          )}
          <span className="ov-class">{character.className}</span>
          <span className="ov-lv">Lv {character.level}</span>
          <span className={`ov-maxed ${character.maxedCount === 8 ? 'full' : ''}`}>{character.statsMaxed}</span>
        </div>
      )}

      {w.target && target && (
        <div className="ov-target">
          {target.biomeId ? (
            <span className="ov-beacon" style={{ background: target.beacon?.color ?? 'var(--gold)' }} />
          ) : (
            <Icon name="pin" size={13} className="ov-target-ico" />
          )}
          <div className="ov-target-main">
            {target.biomeId && (
              <span className="ov-target-line">
                <b>{biomeName(target.biomeId)}</b>
                {target.beacon ? ` · ${target.beacon.label} beacon` : ''}
              </span>
            )}
            {target.dungeon && <span className="ov-target-sub">Enter {target.dungeon}</span>}
          </div>
        </div>
      )}

      {w.beacons && beacons.length > 0 && (
        <div className="ov-beacons">
          <div className="ov-beacons-hdr">Beacons to farm</div>
          {beacons.map((b) => (
            <div key={b.id} className="ov-beacon-row">
              <span className="beacon-dot" style={{ background: b.color }} />
              <span className="ov-beacon-name">{b.name}</span>
              <span className="ov-beacon-meta">
                {b.label}
                {b.pots ? ` · ${b.pots}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {w.goals && goals.length > 0 && (
        <div className="ov-goals">
          {goals.map((g) => (
            <div key={g.id} className={`ov-goal goal-${g.kind}`}>
              <span className="ov-dot" />
              <div className="ov-goal-main">
                <span className="ov-goal-title">{g.title}</span>
                {!settings.compact && g.detail && <span className="ov-goal-detail">{g.detail}</span>}
              </div>
              {w.locations && g.where && <span className="ov-where">{g.where}</span>}
            </div>
          ))}
        </div>
      )}

      {w.setToFarm && recSet && (
        <div className="ov-set">
          <Icon name="sets" size={12} />
          <span className="ov-set-name">{recSet.name}</span>
          {w.locations && recSet.sourceDungeonIds[0] && (
            <span className="ov-where">{dungeonName.get(recSet.sourceDungeonIds[0])}</span>
          )}
        </div>
      )}

      {w.currentDungeon && curDungeon && (
        <div className="ov-dungeon">
          <div className="ov-dungeon-head">
            <Icon name="chest" size={13} /> <b>{curDungeon.name}</b>
          </div>
          {curDungeon.note && <div className="ov-dungeon-note">{curDungeon.note}</div>}
          {curDrops.length > 0 && (
            <div className="ov-dungeon-drops">
              {curDrops.map((d) => (
                <span key={d.slug} className="ov-drop">
                  <span className={`tier tier-${tierCls(d.tier)}`}>{d.tier}</span>
                  {d.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
