import { useMemo, type ReactNode } from 'react';
import type { Character } from '../../../shared/types';
import { buildGoals, recommendSetFor } from '../../../shared/engine';
import { dungeonInfo, verdictMap, type SourceStatus } from '../../../shared/planner';
import type { Location } from '../../../shared/location';
import type { OverlaySettings, OverlayToast } from '../../../shared/overlay';
import { biomes, classMax, dungeons, dungeonName, goalCtx, plannerData, sets, tierClass } from '../gameData';
import { Icon, StatIcon, type IconName } from './Icon';
import { classIcon } from '../classIcons';
import { beaconForBiome, biomeName } from '../beacons';
import { STAT_LABEL } from '../labels';

const STATUS_WORD: Record<SourceStatus, string> = { ready: 'Ready', risky: 'Risky', notReady: 'Not ready', unknown: '' };
const PLACE_ICON: Record<Location['kind'], IconName> = { nexus: 'portal', realm: 'map', dungeon: 'castle', vault: 'chest', hub: 'pin' };

/**
 * The in-game HUD. It reshuffles itself by where you are (detected from the game's log or
 * picked with the quick-pick): in a dungeon the dungeon card and "your loot here" lead; in
 * the Nexus / a realm the "where next" target leads; with no location it's the plan view.
 */
export function OverlayHud({
  character,
  settings,
  toast = null,
  location = null,
}: {
  character: Character | null;
  settings: OverlaySettings;
  /** Latest live-sync change for this character (pushed by the main process). */
  toast?: OverlayToast | null;
  /** Where the player is (null = unknown → plan view + the manually picked dungeon). */
  location?: Location | null;
}) {
  const goals = useMemo(
    () => (character ? buildGoals(character, dungeons, classMax, goalCtx, settings.maxGoals) : []),
    [character, settings.maxGoals],
  );
  const verdicts = useMemo(() => (character ? verdictMap(character, plannerData) : null), [character]);
  const recSet = useMemo(() => (character && verdicts ? recommendSetFor(character, sets, verdicts) : null), [character, verdicts]);

  // The headline "go here next": biome (+ beacon color) and the dungeon to enter.
  const target = useMemo(() => {
    const g = goals[0];
    if (!g) return null;
    const dungeonId = g.sources?.[0]?.id ?? dungeons.find((d) => d.name === g.where?.split(',')[0]?.trim())?.id;
    const biomeId = g.biome ?? (dungeonId ? plannerData.dungeons.find((d) => d.id === dungeonId)?.biome : undefined);
    const dungeon = dungeonId ? dungeonName(dungeonId) : undefined;
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

  // A known location decides the dungeon card; otherwise the manually picked dungeon does.
  const dungeonId = location ? (location.dungeonId ?? '') : settings.currentDungeon;
  const cur = useMemo(() => (dungeonId ? dungeonInfo(dungeonId, plannerData) : null), [dungeonId]);

  const cls = character?.className.toLowerCase() ?? '';
  // Which enemy here drops gear this class can use ("Septavius → ★ Ghostly Prism").
  const bossLoot = useMemo(() => {
    if (!cur || !cls) return [];
    const mine = new Set(cur.gear.filter((g) => g.classes.some((c) => c.toLowerCase() === cls)).map((g) => g.slug));
    const out: { enemy: string; items: string[] }[] = [];
    for (const e of cur.enemies) {
      const items = e.loot.filter((l) => l.kind === 'gear' && mine.has(l.slug)).map((l) => l.name);
      if (items.length) out.push({ enemy: e.sharedBy ? e.sharedBy[0]! + (e.sharedBy.length > 1 ? ` +${e.sharedBy.length - 1}` : '') : e.name, items });
    }
    return out.slice(0, 3);
  }, [cur, cls]);

  if (!character) {
    return <div className="ov-hud ov-empty">Load a player in the app — the overlay follows the active character.</div>;
  }

  const w = settings.widgets;
  const card = settings.dungeonCard;
  const icon = classIcon(character.className);
  const curStatus: SourceStatus = cur ? (verdicts?.get(cur.gate.id) ?? 'unknown') : 'unknown';
  const curDrops = cur
    ? (card.classDropsOnly ? cur.gear.filter((g) => g.classes.some((c) => c.toLowerCase() === cls)) : cur.gear)
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 4)
    : [];
  const inDungeon = !!cur && (!location || location.kind === 'dungeon');
  const inRealm = location?.kind === 'realm';

  const sections: Record<string, ReactNode> = {
    target: w.target && target && (
      <div className="ov-target" key="target">
        {target.biomeId ? (
          <span className="ov-beacon" style={{ background: target.beacon?.color ?? 'var(--gold)' }} />
        ) : (
          <Icon name="pin" size={13} className="ov-target-ico" />
        )}
        <div className="ov-target-main">
          {location && !inDungeon && <span className="ov-target-kicker">{inRealm ? 'Head for' : 'Next stop'}</span>}
          {target.biomeId && (
            <span className="ov-target-line">
              <b>{biomeName(target.biomeId)}</b>
              {target.beacon ? ` · ${target.beacon.label} beacon` : ''}
            </span>
          )}
          {target.dungeon && <span className="ov-target-sub">Enter {target.dungeon}</span>}
        </div>
      </div>
    ),
    beacons: (w.beacons || inRealm) && beacons.length > 0 && (
      <div className="ov-beacons" key="beacons">
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
    ),
    goals: w.goals && goals.length > 0 && (
      <div className="ov-goals" key="goals">
        {(inDungeon ? goals.slice(0, 1) : goals).map((g) => (
          <div key={g.id} className={`ov-goal goal-${g.kind}`}>
            <span className="ov-dot" />
            <div className="ov-goal-main">
              <span className="ov-goal-title">{g.title}</span>
              {!settings.compact && !inDungeon && g.detail && <span className="ov-goal-detail">{g.detail}</span>}
            </div>
            {w.locations && g.where && <span className="ov-where">{g.where}</span>}
          </div>
        ))}
      </div>
    ),
    set: w.setToFarm && recSet && !inDungeon && (
      <div className="ov-set" key="set">
        <Icon name="sets" size={12} />
        <span className="ov-set-name">{recSet.name}</span>
        {w.locations && recSet.sourceDungeonIds[0] && <span className="ov-where">{dungeonName(recSet.sourceDungeonIds[0])}</span>}
      </div>
    ),
    dungeon: (w.currentDungeon || (location?.kind === 'dungeon')) && cur && inDungeon && (
      <div className="ov-dungeon" key="dungeon">
        <div className="ov-dungeon-head">
          <Icon name="castle" size={13} /> <b>{cur.gate.name}</b>
          <span className={`diff diff-${cur.gate.tier}`}>T{cur.gate.tier}</span>
          {curStatus !== 'unknown' && <span className={`ov-status st-${curStatus}`}>{STATUS_WORD[curStatus]}</span>}
          {w.location && location?.kind === 'dungeon' && <span className="ov-loc-src">{location.source === 'log' ? 'auto' : 'picked'}</span>}
        </div>
        {card.exalt && cur.exalt && (
          <div className="ov-dungeon-line">
            <Icon name="exalt" size={11} /> Exalt:{' '}
            {cur.exalt.stats.map((s) => (
              <span key={s} className="ov-stat">
                <StatIcon stat={s} size={10} />
                {STAT_LABEL[s]}
              </span>
            ))}
          </div>
        )}
        {card.pots && cur.potions.length + cur.greater.length > 0 && (
          <div className="ov-dungeon-line">
            <Icon name="flask" size={11} />
            {cur.potions.map((s) => (
              <span key={s} className={`ov-stat ${cur.guaranteed.includes(s) ? 'sure' : ''}`}>
                {STAT_LABEL[s]}
              </span>
            ))}
            {cur.greater.map((s) => (
              <span key={`g-${s}`} className="ov-stat greater">
                {STAT_LABEL[s]}+
              </span>
            ))}
          </div>
        )}
        {card.strategy && cur.gate.note && <div className="ov-dungeon-note">{cur.gate.note}</div>}
        {card.bossLoot && bossLoot.length > 0 && (
          <div className="ov-bossloot">
            {bossLoot.map((b) => (
              <div key={b.enemy} className="ov-bossloot-row">
                <span className="ov-bossloot-enemy">{b.enemy}</span>
                <span className="ov-bossloot-items">
                  {b.items.map((it) => (
                    <span key={it} className="ov-mine">
                      ★ {it}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
        {card.drops && (!card.bossLoot || bossLoot.length === 0) && curDrops.length > 0 && (
          <div className="ov-dungeon-drops">
            {curDrops.map((d) => (
              <span key={d.slug} className="ov-drop">
                <span className={`tier tier-${tierClass(d.tier)}`}>{d.tier}</span>
                {d.name}
              </span>
            ))}
          </div>
        )}
        {card.keyItems && cur.keyItems.length > 0 && (
          <div className="ov-dungeon-line muted">
            <Icon name="chest" size={11} /> {cur.keyItems.join(' · ')}
          </div>
        )}
      </div>
    ),
  };
  // In a dungeon, the dungeon leads; in a realm, beacons right after the target.
  const order = inDungeon ? ['dungeon', 'goals'] : inRealm ? ['target', 'beacons', 'goals', 'set'] : ['target', 'beacons', 'goals', 'set', 'dungeon'];

  return (
    <div className="ov-hud" style={{ transform: `scale(${settings.scale})`, opacity: settings.opacity }}>
      {w.liveToasts && toast && (
        <div className="ov-toast" key={toast.at}>
          <Icon name="refresh" size={12} />
          <div className="ov-toast-body">
            <b>{toast.title}</b>
            {toast.detail && <span>{toast.detail}</span>}
          </div>
          {toast.more > 0 && <span className="ov-toast-more">+{toast.more}</span>}
        </div>
      )}
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
      {w.location && location && !inDungeon && (
        <div className={`ov-loc kind-${location.kind}`}>
          <Icon name={PLACE_ICON[location.kind]} size={12} />
          <b>{location.name}</b>
          <span className="ov-loc-src" title={location.source === 'log' ? "Detected from the game's log" : 'Picked with the quick-pick'}>
            {location.source === 'log' ? 'auto' : 'picked'}
          </span>
        </div>
      )}
      {order.map((k) => sections[k] || null)}
    </div>
  );
}
